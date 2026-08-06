"use client";

/**
 * Registro nativo de staff (/sumate), camino LARGO: el mismo formulario que
 * somosder.ar (StaffRegistro), con CV + autollenado con IA arriba, 6 secciones y
 * consentimiento Ley 25.326. Escribe al mismo pool vía la server action
 * registerApplicant. Es el camino opcional: /sumate abre en el corto (solo el
 * CV) y acá se llega a un click, para el que prefiere escribir todo.
 * La pantalla de éxito vive en sumate-client.tsx, compartida por los dos.
 */

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Upload, ArrowLeft } from "lucide-react";
import { oficios } from "@/lib/data/oficios";
import { paises, provinciasAr } from "@/lib/data/paises";
import {
  WORK_REGIONS, LEGAL_OPTS, AVISO_OPTS, YEARS_OPTS,
  labelCls, inputCls, selectCls, Section, Check, OficiosPicker, useCvAutofill,
  mensajeCv,
} from "@/components/staff-form-shared";
import { subirCvDirecto, type CvSubido } from "@/lib/cv-subida-cliente";
import { PAGO_TEXTO } from "@/lib/pago";
import { registerApplicant } from "./actions";

const SYNE = "font-[family-name:var(--font-syne)]";

export function RegistroForm({
  onDone,
  onVolver,
}: {
  onDone: () => void;
  onVolver: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [consent, setConsent] = useState(false);
  const [oficiosSel, setOficiosSel] = useState<Set<string>>(new Set());
  const [regionsSel, setRegionsSel] = useState<Set<string>>(new Set());
  const cvRef = useRef<HTMLInputElement>(null);
  /**
   * El CV ya subido a Supabase. Se llena al autocompletar, y si la persona no
   * autocompletó, al enviar. Se limpia cuando cambia el archivo elegido, porque
   * si no se guardaría el CV viejo con el formulario nuevo.
   */
  const [cv, setCv] = useState<CvSubido | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const {
    status: afStatus,
    motivoRef: cvMotivo,
    codigoRef: cvCodigo,
    run: runAutofill,
  } = useCvAutofill();

  const [f, setF] = useState({
    nombre: "", apellido: "", email: "", telefono: "", documento: "",
    fecha_nacimiento: "", pais_residencia: "", provincia: "", ciudad: "",
    situacion_legal: "", oficios_otro: "", experiencia: "", anios_experiencia: "",
    experiencia_detalle: "", disponibilidad_finde: false, disponibilidad_viajar: false,
    movilidad_propia: false, disponibilidad_aviso: "", linkedin_url: "", portfolio_url: "", motivacion: "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const toggle = (s: Set<string>, setter: (n: Set<string>) => void, val: string) => {
    const n = new Set(s);
    n.has(val) ? n.delete(val) : n.add(val);
    setter(n);
  };
  const esArgentina = f.pais_residencia === "Argentina";

  async function autofill() {
    const file = cvRef.current?.files?.[0];
    if (!file) {
      toast.error("Elegí tu CV primero.");
      return;
    }
    // El archivo se sube DERECHO A SUPABASE y después se manda a leer por su
    // nombre. Ya no pasa por Vercel, así que los dos techos de tamaño que había
    // acá (4 MB para adjuntar, 3 MB para leer) dejaron de existir.
    // Ver el comentario largo en components/staff-form-shared.tsx.
    // try/finally: si la subida tira, un setSubiendo(false) suelto no corre y la
    // pantalla queda colgada en "Subiendo…" con el envío deshabilitado.
    let sub: Awaited<ReturnType<typeof subirCvDirecto>>;
    setSubiendo(true);
    try {
      sub = await subirCvDirecto(file);
    } finally {
      setSubiendo(false);
    }
    if (!sub.ok) {
      toast.error(sub.reason);
      return;
    }
    setCv(sub.cv);
    const allOficios = oficios.flatMap((g) => g.items.map((it) => it.es));
    const d = await runAutofill(sub.cv, allOficios);
    if (!d) {
      toast.error(mensajeCv(cvMotivo.current, cvCodigo.current));
      return;
    }
    setF((p) => ({
      ...p,
      nombre: d.nombre || p.nombre,
      apellido: d.apellido || p.apellido,
      email: d.email || p.email,
      telefono: d.telefono || p.telefono,
      ciudad: d.ciudad || p.ciudad,
      pais_residencia: d.pais && paises.includes(d.pais) ? d.pais : p.pais_residencia,
      linkedin_url: d.linkedin_url || p.linkedin_url,
      portfolio_url: d.portfolio_url || p.portfolio_url,
      anios_experiencia: d.anios_experiencia && YEARS_OPTS.includes(d.anios_experiencia) ? d.anios_experiencia : p.anios_experiencia,
      experiencia_detalle: d.experiencia_detalle || p.experiencia_detalle,
      experiencia: d.experiencia_detalle ? "Sí" : p.experiencia,
    }));
    if (Array.isArray(d.oficios) && d.oficios.length) {
      setOficiosSel((prev) => {
        const n = new Set(prev);
        d.oficios!.forEach((o) => n.add(o));
        return n;
      });
    }
    toast.success("Listo. Revisá y completá lo que falte.");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    if (!f.nombre.trim() || !f.email.trim()) {
      toast.error("Nombre y email son obligatorios.");
      return;
    }
    if (!consent) {
      toast.error("Necesitás aceptar el tratamiento de datos.");
      return;
    }
    setSending(true);
    const payload = {
      ...f,
      donde_trabajar: [...regionsSel],
      oficios: [...oficiosSel],
      fecha_nacimiento: f.fecha_nacimiento || null,
      experiencia: f.experiencia === "" ? null : f.experiencia === "Sí",
      consentimiento: consent,
      // El servidor usa esto para decidir si estampa perfil_confirmado_at: por
      // este camino la persona vio todos los campos, así que la ficha queda
      // confirmada y el recordatorio de la 0034 no la persigue.
      modo: "completo",
    };
    const fd = new FormData();
    fd.append("payload", JSON.stringify(payload));
    // Si adjuntó un CV pero nunca tocó "Autocompletar", todavía no está subido:
    // se sube ahora. El archivo sigue sin pasar por Vercel.
    const file = cvRef.current?.files?.[0];
    let subido = cv;
    if (file && !subido) {
      let sub: Awaited<ReturnType<typeof subirCvDirecto>>;
      setSubiendo(true);
      try {
        sub = await subirCvDirecto(file);
      } finally {
        setSubiendo(false);
      }
      if (!sub.ok) {
        toast.error(sub.reason);
        setSending(false);
        return;
      }
      subido = sub.cv;
      setCv(sub.cv);
    }
    if (subido) {
      fd.append("cv_path", subido.path);
      fd.append("cv_firma", subido.firma);
    }
    try {
      const res = await registerApplicant(fd);
      if (res.ok) onDone();
      else toast.error(res.reason || "No se pudo enviar.");
    } catch {
      toast.error("No se pudo enviar. Probá de nuevo.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-[820px] mx-auto w-full px-6 md:px-20 py-12 md:py-20">
      <button
        type="button"
        onClick={onVolver}
        className="mb-8 flex items-center gap-2 font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.1em] text-[#988e90] hover:text-[#e5e2e1] transition-colors"
      >
        <ArrowLeft size={14} />
        Volver al registro con CV
      </button>
      <header className="mb-10">
        <p className="label-tech text-[12px] uppercase tracking-[0.2em] text-[#cfc4c5] mb-3">Sumate al pool</p>
        <h1 className="t-display text-[#e5e2e1] uppercase">
          Trabajá en eventos
        </h1>
        <p className="text-[16px] text-[#cfc4c5] mt-4 max-w-[560px] leading-[1.6]">
          Cargá tus datos y sumate al pool de staff de SOMOS DER. Subí tu CV y la
          IA completa lo que puede.
        </p>
        {/* QUE ES OBLIGATORIO DE VERDAD (diagnostico de conversion 2026-07-30,
         * L4). El form tiene ~21 campos y 64 checkboxes de oficios, y los
         * obligatorios son tres: nombre, email y el consentimiento (validado en
         * el servidor, actions.ts). El usuario veia dos asteriscos perdidos en una
         * pagina larguisima y asumia que le pedian todo. El consentimiento se
         * nombra porque el servidor lo rechaza sin el: prometer "solo nombre y
         * email" a secas seria mentira. Y "lo completas despues desde tu perfil"
         * es real: /editar-perfil-staff edita todo esto, oficios incluidos, y se
         * llega desde /panel-staff. */}
        <p className="text-[15px] text-[#cfc4c5] mt-4 max-w-[560px] leading-[1.6]">
          Solo son obligatorios tu nombre y tu email, más el permiso de datos del
          final que pide la ley. El resto lo podés completar después desde tu
          perfil, cuando tengas tiempo.
        </p>
        {/* CUANDO SE COBRA, antes de pedirle los datos (L5). Plazo leido de
         * lib/pago.ts, el unico lugar del sistema donde vive, asi esto no se
         * despega de lo que dice el mail de la oferta. */}
        <p className="text-[15px] text-[#cfc4c5] mt-6 max-w-[560px] leading-[1.7] border-l-2 border-[#0047ff] pl-5">
          Cargar tu perfil es gratis. {PAGO_TEXTO} El monto está escrito en la
          oferta, antes de que aceptes.
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-12">
        {/* CV + autollenado */}
        <section className="border border-[#4c4546] p-6 bg-[#0e0e0e] flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Sparkles size={20} className="text-[#b9c3ff]" />
            <h2 className={`${SYNE} text-[20px] font-semibold text-[#e5e2e1] uppercase`}>Subí tu CV y completamos el resto</h2>
          </div>
          <p className="text-[14px] text-[#cfc4c5] -mt-1">Opcional. PDF o imagen. Revisá antes de enviar.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Cambiar de archivo invalida el que ya se había subido: si no, se
                guardaría el CV viejo con el formulario nuevo. */}
            <input ref={cvRef} type="file" accept=".pdf,image/*" onChange={() => setCv(null)}
              className="text-[14px] text-[#cfc4c5] file:mr-3 file:border file:border-[#4c4546] file:bg-transparent file:text-[#e5e2e1] file:px-4 file:py-2 file:label-tech file:text-[11px] file:uppercase" />
            <button type="button" onClick={autofill} disabled={afStatus === "loading" || subiendo}
              className="inline-flex shrink-0 items-center justify-center gap-2 border border-[#b9c3ff]/50 text-[#b9c3ff] label-tech text-[11px] uppercase tracking-wide px-5 py-2.5 hover:bg-[#b9c3ff] hover:text-black transition-colors disabled:opacity-60">
              <Sparkles size={14} />
              {afStatus === "loading" ? "Leyendo tu CV…" : "Autocompletar con mi CV"}
            </button>
          </div>
        </section>

        {/* Datos */}
        <Section title="Tus datos">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div><label className={labelCls}>Nombre *</label><input className={inputCls} value={f.nombre} onChange={(e) => set("nombre", e.target.value)} required /></div>
            <div><label className={labelCls}>Apellido</label><input className={inputCls} value={f.apellido} onChange={(e) => set("apellido", e.target.value)} /></div>
            <div><label className={labelCls}>Email *</label><input type="email" className={inputCls} value={f.email} onChange={(e) => set("email", e.target.value)} required /></div>
            <div><label className={labelCls}>Teléfono / WhatsApp</label><input className={inputCls} value={f.telefono} onChange={(e) => set("telefono", e.target.value)} placeholder="+54 11 5555 5555" /></div>
            <div><label className={labelCls}>DNI / CUIT / pasaporte</label><input className={inputCls} value={f.documento} onChange={(e) => set("documento", e.target.value)} /></div>
            <div><label className={labelCls}>Fecha de nacimiento</label><input type="date" className={inputCls} value={f.fecha_nacimiento} onChange={(e) => set("fecha_nacimiento", e.target.value)} /></div>
            <div className="md:col-span-2"><label className={labelCls}>País de residencia</label>
              <select className={selectCls} value={f.pais_residencia} onChange={(e) => set("pais_residencia", e.target.value)}>
                <option value="">Elegí…</option>{paises.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </Section>

        {/* Ubicación */}
        <Section title="Dónde estás">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div><label className={labelCls}>Provincia / Estado</label>
              {esArgentina ? (
                <select className={selectCls} value={f.provincia} onChange={(e) => set("provincia", e.target.value)}>
                  <option value="">Elegí…</option>{provinciasAr.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              ) : (
                <input className={inputCls} value={f.provincia} onChange={(e) => set("provincia", e.target.value)} />
              )}
            </div>
            <div><label className={labelCls}>Ciudad</label><input className={inputCls} value={f.ciudad} onChange={(e) => set("ciudad", e.target.value)} /></div>
          </div>
        </Section>

        {/* Dónde querés trabajar */}
        <Section title="Dónde querés trabajar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {WORK_REGIONS.map((r) => <Check key={r} label={r} checked={regionsSel.has(r)} onChange={() => toggle(regionsSel, setRegionsSel, r)} />)}
          </div>
          <div><label className={labelCls}>Situación para trabajar</label>
            <select className={selectCls} value={f.situacion_legal} onChange={(e) => set("situacion_legal", e.target.value)}>
              <option value="">Elegí…</option>{LEGAL_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </Section>

        {/* Oficios */}
        <Section title="Puestos a los que aplicás">
          {/* L4: los oficios son OPCIONALES de verdad. registerApplicant manda
           * p_oficios en null si no hay ninguno marcado y el registro entra
           * igual, asi que decirlo no es una promesa vacia. */}
          <p className="text-[13px] text-[#8a8a8a] -mt-2 leading-[1.6] max-w-[560px]">
            Marcá los que sepas hacer. Si no marcás ninguno, igual entrás al pool
            y lo completás después.
          </p>
          <OficiosPicker oficios={oficios} selected={oficiosSel} onToggle={(v) => toggle(oficiosSel, setOficiosSel, v)} />
          <div><label className={labelCls}>Otro (especificá)</label><input className={inputCls} value={f.oficios_otro} onChange={(e) => set("oficios_otro", e.target.value)} /></div>
        </Section>

        {/* Experiencia */}
        <Section title="Experiencia y disponibilidad">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div><label className={labelCls}>¿Tenés experiencia en eventos?</label>
              <select className={selectCls} value={f.experiencia} onChange={(e) => set("experiencia", e.target.value)}>
                <option value="">Elegí…</option><option value="Sí">Sí</option><option value="No">No</option>
              </select>
            </div>
            <div><label className={labelCls}>Años de experiencia</label>
              <select className={selectCls} value={f.anios_experiencia} onChange={(e) => set("anios_experiencia", e.target.value)}>
                <option value="">Elegí…</option>{YEARS_OPTS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div><label className={labelCls}>Contanos tu experiencia</label>
            <textarea className={`${inputCls} resize-none`} rows={3} value={f.experiencia_detalle} onChange={(e) => set("experiencia_detalle", e.target.value)} placeholder="Eventos, roles, marcas con las que trabajaste…" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Check label="Disponible fines de semana" checked={f.disponibilidad_finde} onChange={(v) => set("disponibilidad_finde", v)} />
            <Check label="Disponible para viajar" checked={f.disponibilidad_viajar} onChange={(v) => set("disponibilidad_viajar", v)} />
            <Check label="Movilidad propia" checked={f.movilidad_propia} onChange={(v) => set("movilidad_propia", v)} />
          </div>
          <div><label className={labelCls}>¿Con cuánta anticipación podés tomar un trabajo?</label>
            <select className={selectCls} value={f.disponibilidad_aviso} onChange={(e) => set("disponibilidad_aviso", e.target.value)}>
              <option value="">Elegí…</option>{AVISO_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </Section>

        {/* Links */}
        <Section title="Links">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div><label className={labelCls}>LinkedIn</label><input className={inputCls} value={f.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)} placeholder="https://" /></div>
            <div><label className={labelCls}>Portfolio</label><input className={inputCls} value={f.portfolio_url} onChange={(e) => set("portfolio_url", e.target.value)} placeholder="https://" /></div>
          </div>
          <div><label className={labelCls}>¿Por qué querés sumarte a DER?</label><textarea className={`${inputCls} resize-none`} rows={3} value={f.motivacion} onChange={(e) => set("motivacion", e.target.value)} /></div>
        </Section>

        <label className="flex items-start gap-3 text-[13px] text-[#cfc4c5] leading-[1.5] border-t border-[#1A1A1A] pt-6">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 accent-[#c6c6c6]" />
          Acepto que SOMOS DER, como responsable de la base de datos, almacene y trate
          mis datos personales para evaluarme para trabajos en eventos. Puedo acceder,
          rectificar o suprimir mis datos escribiendo a rrhh@somosder.com.ar (Ley 25.326).
        </label>

        <button type="submit" disabled={sending}
          className="self-start flex items-center gap-3 bg-[#e5e2e1] text-black label-tech text-[12px] uppercase tracking-widest px-12 py-5 border border-[#e5e2e1] hover:bg-transparent hover:text-[#e5e2e1] transition-colors disabled:opacity-50">
          <Upload size={16} />
          {sending ? "Enviando…" : "Enviar mi registro"}
        </button>
      </form>
    </div>
  );
}
