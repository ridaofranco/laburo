"use client";

/**
 * Editor de perfil del staff — refleja TODO el formulario de postulación de
 * SOMOS DER (StaffRegistro): datos + país + fecha nac + documento, ubicación,
 * dónde trabajar, oficios agrupados, experiencia/disponibilidad, links, y CV
 * (ver el actual + subir/reemplazar). Prefill con los datos reales; guarda vía
 * server actions self-scoped. Misma taxonomía (oficios/paises) que la web.
 */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, FileText, Upload, ExternalLink, ChevronDown, Sparkles } from "lucide-react";
import { oficios } from "@/lib/data/oficios";
import { paises, provinciasAr } from "@/lib/data/paises";
import { useCvAutofill } from "@/components/staff-form-shared";
import { updateMyStaffProfile, uploadMyCv, signMyStaffCv } from "./actions";
import type { StaffProfile } from "@/lib/staff";

const WORK_REGIONS = [
  "En mi país de residencia",
  "Argentina",
  "Resto de LATAM",
  "España / Europa",
  "EEUU / Canadá",
  "Medio Oriente",
  "Cualquier país — dispuesto/a a viajar",
];
const LEGAL_OPTS = [
  "Ciudadano/a o residente con permiso",
  "Tengo permiso de trabajo",
  "Necesitaría sponsor / visa",
  "No estoy seguro/a",
];
const AVISO_OPTS = [
  "Disponibilidad inmediata",
  "Con 24–48 hs de aviso",
  "Con 1 semana de aviso",
  "A coordinar",
];
const YEARS_OPTS = ["0–1", "1–3", "3–5", "5–10", "10+"];

const labelCls = "block mb-2 label-tech text-[11px] uppercase tracking-[0.1em] text-[#cfc4c5]";
const inputCls =
  "w-full bg-transparent border-0 border-b border-[#4c4546] focus:border-[#e5e2e1] outline-none text-[16px] text-[#e5e2e1] py-3 px-0 rounded-none transition-colors placeholder:text-[#565656] [color-scheme:dark]";
const selectCls = `${inputCls} appearance-none`;
const sectionTitle = "font-[family-name:var(--font-syne)] text-[22px] font-semibold text-[#c6c6c6] uppercase tracking-tight";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-6 border-t border-[#1A1A1A] pt-8">
      <h2 className={sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 border border-[#4c4546] px-4 py-3 cursor-pointer hover:border-[#c6c6c6] transition-colors">
      <span
        className={`w-5 h-5 border grid place-items-center text-[11px] shrink-0 ${
          checked ? "bg-[#c6c6c6] border-[#c6c6c6] text-black" : "border-[#4c4546]"
        }`}
      >
        {checked ? "✓" : ""}
      </span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-[14px] text-[#e5e2e1]">{label}</span>
    </label>
  );
}

export function EditProfileForm({ profile }: { profile: StaffProfile }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [oficiosSel, setOficiosSel] = useState<Set<string>>(
    new Set((profile.oficios ?? []).filter(Boolean)),
  );
  const [regionsSel, setRegionsSel] = useState<Set<string>>(
    new Set((profile.donde_trabajar ?? []).filter(Boolean)),
  );
  const [f, setF] = useState({
    nombre: profile.nombre ?? "",
    apellido: profile.apellido ?? "",
    telefono: profile.telefono ?? "",
    documento: profile.documento ?? "",
    fecha_nacimiento: (profile.fecha_nacimiento ?? "").slice(0, 10),
    pais_residencia: profile.pais_residencia ?? "",
    provincia: profile.provincia ?? "",
    ciudad: profile.ciudad ?? "",
    situacion_legal: profile.situacion_legal ?? "",
    oficios_otro: profile.oficios_otro ?? "",
    experiencia: profile.experiencia == null ? "" : profile.experiencia ? "Sí" : "No",
    anios_experiencia: profile.anios_experiencia ?? "",
    experiencia_detalle: profile.experiencia_detalle ?? "",
    disponibilidad_finde: profile.disponibilidad_finde ?? false,
    disponibilidad_viajar: profile.disponibilidad_viajar ?? false,
    movilidad_propia: profile.movilidad_propia ?? false,
    disponibilidad_aviso: profile.disponibilidad_aviso ?? "",
    linkedin_url: profile.linkedin_url ?? "",
    portfolio_url: profile.portfolio_url ?? "",
    motivacion: profile.motivacion ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const toggleSet = (s: Set<string>, setter: (n: Set<string>) => void, val: string) => {
    const n = new Set(s);
    if (n.has(val)) n.delete(val);
    else n.add(val);
    setter(n);
  };

  const esArgentina = f.pais_residencia === "Argentina";

  const afRef = useRef<HTMLInputElement>(null);
  const { status: afStatus, run: runAutofill } = useCvAutofill();
  async function autofill() {
    const file = afRef.current?.files?.[0];
    if (!file) {
      toast.error("Elegí un CV primero.");
      return;
    }
    const all = oficios.flatMap((g) => g.items.map((it) => it.es));
    const d = await runAutofill(file, all);
    if (!d) {
      toast.error(afStatus === "nokey" ? "El autollenado no está configurado todavía." : "No pudimos leer el CV.");
      return;
    }
    setF((p) => ({
      ...p,
      nombre: d.nombre || p.nombre,
      apellido: d.apellido || p.apellido,
      telefono: d.telefono || p.telefono,
      ciudad: d.ciudad || p.ciudad,
      pais_residencia: d.pais && paises.includes(d.pais) ? d.pais : p.pais_residencia,
      linkedin_url: d.linkedin_url || p.linkedin_url,
      portfolio_url: d.portfolio_url || p.portfolio_url,
      anios_experiencia: d.anios_experiencia && ["0–1", "1–3", "3–5", "5–10", "10+"].includes(d.anios_experiencia) ? d.anios_experiencia : p.anios_experiencia,
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
    toast.success("Listo. Revisá los datos.");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!f.nombre.trim()) {
      toast.error("Poné tu nombre.");
      return;
    }
    setSaving(true);
    const res = await updateMyStaffProfile({
      nombre: f.nombre.trim(),
      apellido: f.apellido.trim(),
      telefono: f.telefono.trim(),
      documento: f.documento.trim(),
      fecha_nacimiento: f.fecha_nacimiento || null,
      pais_residencia: f.pais_residencia.trim(),
      provincia: f.provincia.trim(),
      ciudad: f.ciudad.trim(),
      donde_trabajar: [...regionsSel],
      situacion_legal: f.situacion_legal.trim(),
      oficios: [...oficiosSel],
      oficios_otro: f.oficios_otro.trim(),
      experiencia: f.experiencia === "" ? null : f.experiencia === "Sí",
      anios_experiencia: f.anios_experiencia.trim(),
      experiencia_detalle: f.experiencia_detalle.trim(),
      disponibilidad_finde: f.disponibilidad_finde,
      disponibilidad_viajar: f.disponibilidad_viajar,
      movilidad_propia: f.movilidad_propia,
      disponibilidad_aviso: f.disponibilidad_aviso.trim(),
      linkedin_url: f.linkedin_url.trim(),
      portfolio_url: f.portfolio_url.trim(),
      motivacion: f.motivacion.trim(),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Perfil actualizado");
      router.refresh();
    } else {
      toast.error(res.reason || "No se pudo guardar");
    }
  }

  const nombreCompleto = [profile.nombre, profile.apellido].filter(Boolean).join(" ").trim() || "Tu cuenta";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-12">
      {/* Cuenta */}
      <section className="flex flex-col gap-2">
        <span className={labelCls}>Tu cuenta</span>
        <p className="font-[family-name:var(--font-syne)] text-[28px] font-semibold text-[#e5e2e1] uppercase">
          {nombreCompleto}
        </p>
        <p className="text-[14px] text-[#cfc4c5]">{profile.email}</p>
      </section>

      {/* CV */}
      <CvSection cvUrl={profile.cv_url} />

      {/* Autollenado con IA */}
      <section className="border border-[#b9c3ff]/30 bg-[#b9c3ff]/[0.05] p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Sparkles size={20} className="text-[#b9c3ff]" />
          <h2 className={sectionTitle}>Autocompletar con tu CV</h2>
        </div>
        <p className="text-[14px] text-[#cfc4c5] -mt-2">
          Subí un CV (PDF o imagen) y la IA completa los campos que pueda. Revisá antes de guardar.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input ref={afRef} type="file" accept=".pdf,image/*"
            className="text-[14px] text-[#cfc4c5] file:mr-3 file:border file:border-[#4c4546] file:bg-transparent file:text-[#e5e2e1] file:px-4 file:py-2 file:label-tech file:text-[11px] file:uppercase" />
          <button type="button" onClick={autofill} disabled={afStatus === "loading"}
            className="inline-flex shrink-0 items-center justify-center gap-2 border border-[#b9c3ff]/50 text-[#b9c3ff] label-tech text-[11px] uppercase tracking-wide px-5 py-2.5 hover:bg-[#b9c3ff] hover:text-black transition-colors disabled:opacity-60">
            <Sparkles size={14} />
            {afStatus === "loading" ? "Leyendo…" : "Autocompletar"}
          </button>
        </div>
      </section>

      {/* Datos */}
      <Section title="Tus datos">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className={labelCls}>Nombre</label>
            <input className={inputCls} value={f.nombre} onChange={(e) => set("nombre", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Apellido</label>
            <input className={inputCls} value={f.apellido} onChange={(e) => set("apellido", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Teléfono / WhatsApp</label>
            <input className={inputCls} value={f.telefono} onChange={(e) => set("telefono", e.target.value)} placeholder="+54 11 5555 5555" />
          </div>
          <div>
            <label className={labelCls}>DNI / CUIT / pasaporte</label>
            <input className={inputCls} value={f.documento} onChange={(e) => set("documento", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Fecha de nacimiento</label>
            <input type="date" className={inputCls} value={f.fecha_nacimiento} onChange={(e) => set("fecha_nacimiento", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>País de residencia</label>
            <select className={selectCls} value={f.pais_residencia} onChange={(e) => set("pais_residencia", e.target.value)}>
              <option value="">Elegí…</option>
              {paises.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </Section>

      {/* Ubicación */}
      <Section title="Dónde estás">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className={labelCls}>Provincia / Estado</label>
            {esArgentina ? (
              <select className={selectCls} value={f.provincia} onChange={(e) => set("provincia", e.target.value)}>
                <option value="">Elegí…</option>
                {provinciasAr.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            ) : (
              <input className={inputCls} value={f.provincia} onChange={(e) => set("provincia", e.target.value)} />
            )}
          </div>
          <div>
            <label className={labelCls}>Ciudad</label>
            <input className={inputCls} value={f.ciudad} onChange={(e) => set("ciudad", e.target.value)} />
          </div>
        </div>
      </Section>

      {/* Dónde querés trabajar */}
      <Section title="Dónde querés trabajar">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {WORK_REGIONS.map((r) => (
            <Check key={r} label={r} checked={regionsSel.has(r)} onChange={() => toggleSet(regionsSel, setRegionsSel, r)} />
          ))}
        </div>
        <div>
          <label className={labelCls}>Situación para trabajar</label>
          <select className={selectCls} value={f.situacion_legal} onChange={(e) => set("situacion_legal", e.target.value)}>
            <option value="">Elegí…</option>
            {LEGAL_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </Section>

      {/* Oficios */}
      <Section title="Puestos a los que aplicás">
        <p className="label-tech text-[11px] text-[#565656] -mt-2">Marcá todos los que apliquen.</p>
        <div className="border border-[#1A1A1A]">
          {oficios.map((g) => {
            const count = g.items.filter((it) => oficiosSel.has(it.es)).length;
            return (
              <details key={g.cat.es} className="group border-b border-[#1A1A1A] last:border-0" open={count > 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
                  <span className="label-tech text-[11px] uppercase tracking-widest text-[#cfc4c5]">
                    {g.cat.es}{count > 0 ? ` · ${count}` : ""}
                  </span>
                  <ChevronDown size={16} className="text-[#c6c6c6] transition-transform group-open:rotate-180" />
                </summary>
                <div className="grid gap-2 px-4 pb-4 sm:grid-cols-2">
                  {g.items.map((it) => (
                    <Check key={it.es} label={it.es} checked={oficiosSel.has(it.es)} onChange={() => toggleSet(oficiosSel, setOficiosSel, it.es)} />
                  ))}
                </div>
              </details>
            );
          })}
        </div>
        <div>
          <label className={labelCls}>Otro (especificá)</label>
          <input className={inputCls} value={f.oficios_otro} onChange={(e) => set("oficios_otro", e.target.value)} />
        </div>
      </Section>

      {/* Experiencia y disponibilidad */}
      <Section title="Experiencia y disponibilidad">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className={labelCls}>¿Tenés experiencia en eventos?</label>
            <select className={selectCls} value={f.experiencia} onChange={(e) => set("experiencia", e.target.value)}>
              <option value="">Elegí…</option>
              <option value="Sí">Sí</option>
              <option value="No">No</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Años de experiencia</label>
            <select className={selectCls} value={f.anios_experiencia} onChange={(e) => set("anios_experiencia", e.target.value)}>
              <option value="">Elegí…</option>
              {YEARS_OPTS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Contanos tu experiencia</label>
          <textarea className={`${inputCls} resize-none`} rows={3} value={f.experiencia_detalle} onChange={(e) => set("experiencia_detalle", e.target.value)} placeholder="Eventos, roles, marcas con las que trabajaste…" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Check label="Disponible fines de semana" checked={f.disponibilidad_finde} onChange={(v) => set("disponibilidad_finde", v)} />
          <Check label="Disponible para viajar" checked={f.disponibilidad_viajar} onChange={(v) => set("disponibilidad_viajar", v)} />
          <Check label="Movilidad propia" checked={f.movilidad_propia} onChange={(v) => set("movilidad_propia", v)} />
        </div>
        <div>
          <label className={labelCls}>¿Con cuánta anticipación podés tomar un trabajo?</label>
          <select className={selectCls} value={f.disponibilidad_aviso} onChange={(e) => set("disponibilidad_aviso", e.target.value)}>
            <option value="">Elegí…</option>
            {AVISO_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </Section>

      {/* Links */}
      <Section title="Links">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className={labelCls}>LinkedIn</label>
            <input className={inputCls} value={f.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)} placeholder="https://" />
          </div>
          <div>
            <label className={labelCls}>Portfolio</label>
            <input className={inputCls} value={f.portfolio_url} onChange={(e) => set("portfolio_url", e.target.value)} placeholder="https://" />
          </div>
        </div>
        <div>
          <label className={labelCls}>Sobre vos</label>
          <textarea className={`${inputCls} resize-none`} rows={3} value={f.motivacion} onChange={(e) => set("motivacion", e.target.value)} />
        </div>
      </Section>

      <div className="flex justify-end border-t border-[#1A1A1A] pt-8 sticky bottom-0 bg-[#131313]/90 backdrop-blur -mx-6 md:-mx-20 px-6 md:px-20 py-4">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-3 bg-[#e5e2e1] text-black label-tech text-[12px] uppercase tracking-widest px-10 py-5 border border-[#e5e2e1] hover:bg-transparent hover:text-[#e5e2e1] transition-colors disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}

/** Sección de CV: ver el actual (bucket/drive) + subir/reemplazar. */
function CvSection({ cvUrl }: { cvUrl: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const tieneCv = Boolean(cvUrl && cvUrl.trim());

  async function verCv() {
    const res = await signMyStaffCv();
    if (res.kind === "none" || !res.url) {
      toast.error("No pudimos abrir tu CV.");
      return;
    }
    setViewUrl(res.url);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("cv", file);
    const res = await uploadMyCv(fd);
    setUploading(false);
    e.target.value = "";
    if (res.ok) {
      toast.success("CV actualizado");
      startTransition(() => router.refresh());
    } else {
      toast.error(res.reason || "No se pudo subir el CV.");
    }
  }

  return (
    <section className="flex flex-col gap-5 border border-[#4c4546] p-6 bg-[#0e0e0e]">
      <div className="flex items-center gap-3">
        <FileText size={20} className="text-[#c6c6c6]" />
        <h2 className={sectionTitle}>Tu CV</h2>
      </div>
      <p className="text-[14px] text-[#cfc4c5] -mt-2 leading-[1.5]">
        {tieneCv
          ? "Ya tenés un CV cargado. Podés verlo o subir uno nuevo para reemplazarlo."
          : "Todavía no cargaste tu CV. Subilo en PDF, Word o imagen."}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {tieneCv && (
          <button
            type="button"
            onClick={verCv}
            className="inline-flex items-center gap-2 border border-[#4c4546] text-[#e5e2e1] label-tech text-[11px] uppercase tracking-widest px-5 py-3 hover:border-[#c6c6c6] transition-colors"
          >
            <ExternalLink size={14} /> Ver mi CV
          </button>
        )}
        <label className="inline-flex items-center gap-2 bg-[#c6c6c6] text-black label-tech text-[11px] uppercase tracking-widest px-5 py-3 border border-[#c6c6c6] hover:bg-transparent hover:text-[#c6c6c6] transition-colors cursor-pointer">
          <Upload size={14} />
          {uploading || pending ? "Subiendo…" : tieneCv ? "Reemplazar CV" : "Subir CV"}
          <input type="file" accept=".pdf,.doc,.docx,image/*" className="sr-only" onChange={onFile} disabled={uploading} />
        </label>
      </div>
      {viewUrl && (
        <iframe title="Mi CV" src={viewUrl} className="w-full h-[480px] border border-[#1A1A1A] bg-white" />
      )}
    </section>
  );
}
