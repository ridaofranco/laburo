"use client";

/**
 * Registro CORTO: alcanza con el CV (decisión de Franco, 31/7).
 *
 * El formulario largo tiene ~21 campos y 64 checkboxes de oficios, y los
 * obligatorios de verdad son tres: nombre, email y el consentimiento. Este
 * camino invierte el orden. La persona adjunta el CV, el parser que ya existe
 * (/api/parse-cv) saca los datos, y lo único que queda por hacer es el
 * consentimiento. Nombre y email se piden SOLO si el CV no los trajo.
 *
 * La ficha que sale de acá queda a medias a propósito: no se estampa
 * perfil_confirmado_at (ver el gate en actions.ts), así que el recordatorio de
 * la migración 0034 la agarra a los 5 días y la invita a completarla.
 */

import { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { FileUp, Upload } from "lucide-react";
import { oficios } from "@/lib/data/oficios";
import { paises } from "@/lib/data/paises";
import {
  YEARS_OPTS,
  labelCls,
  inputCls,
  useCvAutofill,
  mensajeCv,
  type CvParsed,
} from "@/components/staff-form-shared";
import { subirCvDirecto, type CvSubido } from "@/lib/cv-subida-cliente";
import { PAGO_TEXTO } from "@/lib/pago";
import { registerApplicant } from "./actions";


/** Catálogo plano de oficios: es lo que se le pasa al parser y la allowlist del payload. */
const ALL_OFICIOS = oficios.flatMap((g) => g.items.map((it) => it.es));
const OFICIOS_SET = new Set(ALL_OFICIOS);

export function RegistroRapido({
  onDone,
  onFormularioLargo,
}: {
  onDone: () => void;
  onFormularioLargo: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  /** El CV ya subido a Supabase: es lo único que viaja al servidor al enviar. */
  const [cv, setCv] = useState<CvSubido | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [parsed, setParsed] = useState<CvParsed | null>(null);
  const [nombreVisible, setNombreVisible] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [editar, setEditar] = useState(false);
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const {
    status: afStatus,
    motivoRef: cvMotivo,
    codigoRef: cvCodigo,
    run: runAutofill,
  } = useCvAutofill();

  // "Ocupado" es subiendo O leyendo: son dos pasos seguidos y para la persona es
  // un solo momento de espera. Si solo se mirara la lectura, durante la subida
  // los botones quedarían habilitados y se podría enviar sin CV sin querer.
  const leyendo = subiendo || afStatus === "loading";
  const faltaNombre = !nombreVisible.trim();
  const faltaEmail = !email.trim();
  const mostrarNombre = editar || faltaNombre;
  const mostrarEmail = editar || faltaEmail;
  // El teléfono NUNCA bloquea el alta (es opcional acá y en el RPC desde la
  // 0046), pero las ofertas se mueven por WhatsApp: si el CV no lo trajo, se
  // ofrece el campo para que lo deje ahora.
  const mostrarTelefono = editar || !telefono.trim();
  const parserFallo = afStatus === "error" || afStatus === "nokey";

  /** Lo que se anuncia por aria-live cada vez que cambia el estado de lectura. */
  const estadoTexto = subiendo
    ? "Subiendo tu CV…"
    : afStatus === "loading"
    ? "Leyendo tu CV…"
    : afStatus === "ok"
      ? "Listo, leímos tu CV. Revisá que esté bien y enviá."
      : parserFallo
        ? "No pudimos leer el CV automáticamente, pero se sube igual. Escribí tu nombre y tu mail y ya quedás anotado."
        : file
          ? `Adjuntaste ${file.name}.`
          : "";

  /**
   * Adjuntar dispara la subida y la lectura solas, sin botón intermedio.
   *
   * EL ORDEN CAMBIÓ Y ES EL PUNTO DEL ARREGLO (6/8): primero el archivo se sube
   * DERECHO A SUPABASE, y recién después se lo manda a leer por su nombre. Antes
   * el archivo viajaba dos veces por Vercel (una en base64 para leerlo, otra
   * adentro del Server Action para guardarlo) y chocaba contra dos topes de
   * infraestructura que en pantalla se veían como "no se pudo leer" y "no te
   * deja enviar". Ahora no toca Vercel y esos dos topes no existen más.
   *
   * UN SOLO intento de lectura por selección: cada llamada gasta cuota de
   * Gemini. Si falló, la salida es escribir los dos datos a mano.
   */
  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setCv(null);
    if (!f) {
      setFile(null);
      return;
    }
    setFile(f);
    // try/finally, no dos líneas sueltas: si la subida tira, un `setSubiendo(false)`
    // suelto no corre y la pantalla queda en "Subiendo tu CV…" para siempre, con
    // el botón de enviar deshabilitado. Encerrar a la persona es lo peor que
    // puede hacer este formulario. Pasó el 6/8.
    let sub: Awaited<ReturnType<typeof subirCvDirecto>>;
    setSubiendo(true);
    try {
      sub = await subirCvDirecto(f);
    } finally {
      setSubiendo(false);
    }
    if (!sub.ok) {
      // El formato y el tamaño se deciden acá adentro, mirando los bytes reales
      // del archivo, así que el mensaje ya viene explicando qué pasó.
      toast.error(sub.reason);
      e.target.value = "";
      setFile(null);
      return;
    }
    setCv(sub.cv);
    const d = await runAutofill(sub.cv, ALL_OFICIOS);
    // Decirle POR QUÉ. Antes esto era un `return` mudo: el CV quedaba adjunto,
    // no se completaba ningún campo y la persona no tenía forma de saber si
    // había pasado algo o si la pantalla estaba rota.
    if (!d) {
      toast(mensajeCv(cvMotivo.current, cvCodigo.current));
      return;
    }
    setParsed(d);
    const nom = [d.nombre, d.apellido].filter(Boolean).join(" ").trim();
    if (nom) setNombreVisible(nom);
    if (d.email) setEmail(d.email);
    if (d.telefono) setTelefono(d.telefono);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    // ⭐ EL CV YA NO ES OBLIGATORIO (1/8).
    //
    // Antes, sin archivo adjunto el alta se cortaba acá. Eso ataba la única vía
    // corta de registro a que la persona tuviera el CV a mano Y a que un
    // servicio de IA externo estuviera disponible. El 1/8 Gemini empezó a
    // devolver 403 en TODO el ecosistema (verificado: mismo error en
    // somosder.ar), y con eso la puerta de entrada quedaba en manos de Google.
    //
    // Ahora el CV se sube si está y si no, no. La persona queda en el pool con
    // nombre y mail, y carga el CV después desde su perfil (esa pantalla ya
    // existe: /editar-perfil-staff, CvSection). Es más engorroso, y es
    // infinitamente mejor que no poder anotarse.
    const nom = nombreVisible.trim();
    if (!nom || !email.trim()) {
      toast.error("Nos falta tu nombre y tu email.");
      return;
    }
    if (!consent) {
      toast.error("Necesitás aceptar el tratamiento de datos.");
      return;
    }
    setSending(true);
    // Split first-token / resto, la misma convención con la que entró todo el
    // pool viejo. Sin pérdida: lo que no es el primer token va a apellido.
    const [primero, ...resto] = nom.split(/\s+/);
    const d = parsed;
    const payload = {
      nombre: primero,
      apellido: resto.join(" "),
      email: email.trim(),
      telefono: telefono.trim(),
      ciudad: d?.ciudad ?? "",
      pais_residencia: d?.pais && paises.includes(d.pais) ? d.pais : "",
      linkedin_url: d?.linkedin_url ?? "",
      portfolio_url: d?.portfolio_url ?? "",
      anios_experiencia:
        d?.anios_experiencia && YEARS_OPTS.includes(d.anios_experiencia)
          ? d.anios_experiencia
          : "",
      experiencia_detalle: d?.experiencia_detalle ?? "",
      experiencia: d?.experiencia_detalle ? true : null,
      oficios: (d?.oficios ?? []).filter((o) => OFICIOS_SET.has(o)),
      consentimiento: consent,
      modo: "rapido",
    };
    const fd = new FormData();
    fd.append("payload", JSON.stringify(payload));
    // EL ARCHIVO YA NO VIAJA ACÁ. Va su nombre en el bucket, más la firma que lo
    // acredita como emitido por el servidor. Este era el envío que "no dejaba
    // enviar": el CV iba adentro del Server Action y por arriba del límite la
    // request moría antes de llegar al servidor, sin motivo que mostrar.
    if (cv) {
      fd.append("cv_path", cv.path);
      fd.append("cv_firma", cv.firma);
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
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-[560px] mx-auto w-full px-6 md:px-0 py-10 md:py-20"
    >
      <header className="mb-8">
        <p className="label-tech text-[12px] uppercase tracking-[0.2em] text-[#cfc4c5] mb-3">
          Sumate al pool
        </p>
        <h1
          className="t-display text-[#e5e2e1] uppercase"
        >
          Sumate con tu CV
        </h1>
        <p className="text-[16px] text-[#cfc4c5] mt-4 leading-[1.6]">
          Adjuntá tu CV (o sacale una foto) y leemos tus datos solos. Si no lo
          tenés a mano, escribí tu nombre y tu mail y listo: quedás en el pool de
          staff de SOMOS DER y el CV lo cargás después desde tu perfil.
        </p>
        <p className="text-[14px] text-[#cfc4c5] mt-5 leading-[1.7] border-l-2 border-[#0047ff] pl-4">
          Cargar tu perfil es gratis. {PAGO_TEXTO} El monto está escrito en la
          oferta, antes de que aceptes.
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-8">
        {/* El adjunto. Input nativo: enfocable con teclado y con foco visible. */}
        <section
          aria-busy={leyendo}
          className="border border-[#4c4546] bg-[#0e0e0e] p-5 flex flex-col gap-3"
        >
          <label
            htmlFor="cv-rapido"
            className="flex items-center gap-3 label-tech text-[12px] uppercase tracking-[0.1em] text-[#e5e2e1]"
          >
            <FileUp size={18} className="text-[#b9c3ff]" />
            Tu CV, en PDF o foto (opcional)
          </label>
          <input
            id="cv-rapido"
            type="file"
            accept=".pdf,image/*"
            onChange={onPick}
            disabled={leyendo || sending}
            className="w-full text-[14px] text-[#cfc4c5] rounded-none file:mr-3 file:border file:border-[#4c4546] file:bg-transparent file:text-[#e5e2e1] file:px-4 file:py-3 file:label-tech file:text-[11px] file:uppercase file:cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9c3ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e0e0e] disabled:opacity-60"
          />
          <p
            role="status"
            aria-live="polite"
            className={`text-[14px] leading-[1.5] min-h-[20px] ${
              parserFallo ? "text-[#cfc4c5]" : "text-[#b9c3ff]"
            }`}
          >
            {estadoTexto}
          </p>
        </section>

        {/* Nombre y mail. Se muestran SIEMPRE, no solo cuando hay CV adjunto:
            antes esta sección aparecía recién al adjuntar, así que el que no
            tenía CV a mano se quedaba mirando una pantalla sin ningún campo
            para llenar. Si el CV se leyó bien, esto colapsa solo a la línea
            "Te registramos como X" con su "Corregir". Se sigue pidiendo lo que
            falta y nunca más que eso. */}
        {
          <section className="flex flex-col gap-6">
            {!mostrarNombre && !mostrarEmail ? (
              <div className="flex flex-col gap-3">
                <p className="text-[16px] text-[#e5e2e1] leading-[1.6]">
                  Te registramos como{" "}
                  <span className="text-[#b9c3ff]">{nombreVisible}</span>,{" "}
                  <span className="text-[#b9c3ff]">{email}</span>.
                </p>
                <button
                  type="button"
                  onClick={() => setEditar(true)}
                  className="self-start font-[family-name:var(--font-geist)] text-[13px] text-[#988e90] hover:text-[#e5e2e1] transition-colors underline underline-offset-4"
                >
                  Corregir
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {mostrarNombre ? (
                  <div>
                    <label className={labelCls} htmlFor="nombre-rapido">
                      Nombre y apellido *
                    </label>
                    <input
                      id="nombre-rapido"
                      className={inputCls}
                      value={nombreVisible}
                      onChange={(ev) => setNombreVisible(ev.target.value)}
                      autoComplete="name"
                      required
                    />
                  </div>
                ) : null}
                {mostrarEmail ? (
                  <div>
                    <label className={labelCls} htmlFor="email-rapido">
                      Email *
                    </label>
                    <input
                      id="email-rapido"
                      type="email"
                      className={inputCls}
                      value={email}
                      onChange={(ev) => setEmail(ev.target.value)}
                      autoComplete="email"
                      required
                    />
                  </div>
                ) : null}
              </div>
            )}
            {mostrarTelefono ? (
              <div>
                <label className={labelCls} htmlFor="telefono-rapido">
                  WhatsApp (opcional)
                </label>
                <input
                  id="telefono-rapido"
                  type="tel"
                  className={inputCls}
                  value={telefono}
                  onChange={(ev) => setTelefono(ev.target.value)}
                  autoComplete="tel"
                  placeholder="+54 11 5555 5555"
                />
                <p className="text-[12px] text-[#988e90] mt-2 leading-[1.5]">
                  Si lo dejás, las ofertas te llegan también por WhatsApp.
                </p>
              </div>
            ) : null}
          </section>
        }

        {/* Ley 25.326: un solo click, al lado del botón. El servidor lo exige, no
            se puede sacar ni esconder. Texto idéntico al del formulario largo. */}
        <label className="flex items-start gap-3 text-[13px] text-[#cfc4c5] leading-[1.5] border-t border-[#1A1A1A] pt-6">
          <input
            type="checkbox"
            checked={consent}
            onChange={(ev) => setConsent(ev.target.checked)}
            className="mt-1 accent-[#c6c6c6]"
          />
          Acepto que SOMOS DER, como responsable de la base de datos, almacene y trate
          mis datos personales para evaluarme para trabajos en eventos. Puedo acceder,
          rectificar o suprimir mis datos escribiendo a rrhh@somosder.com.ar (Ley 25.326).
        </label>

        <button
          type="submit"
          disabled={sending || leyendo}
          className="w-full sm:w-auto sm:self-start flex items-center justify-center gap-3 bg-[#e5e2e1] text-black label-tech text-[12px] uppercase tracking-widest px-10 py-5 border border-[#e5e2e1] hover:bg-transparent hover:text-[#e5e2e1] transition-colors disabled:opacity-50"
        >
          <Upload size={16} />
          {sending ? "Enviando…" : subiendo ? "Subiendo tu CV…" : leyendo ? "Leyendo tu CV…" : "Listo, sumame"}
        </button>

        <button
          type="button"
          onClick={onFormularioLargo}
          className="self-start font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.1em] text-[#988e90] hover:text-[#e5e2e1] transition-colors"
        >
          Prefiero completar todo a mano
        </button>
      </form>
    </motion.div>
  );
}
