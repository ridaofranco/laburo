"use client";

/**
 * El formulario con el que un cliente final pide un presupuesto.
 *
 * Lo usan las DOS vidrieras: la de proveedores (`/servicios/[slug]`) y la de
 * salones (`/salones/[slug]`). Vivía adentro de `/servicios/[slug]` y se movió
 * acá cuando entró el cuarto pool, sin cambiarle una coma al comportamiento: lo
 * único que se sumó son los tres textos que nombran a quién se le escribe.
 *
 * ── POR QUÉ COMPARTIDO Y NO COPIADO ─────────────────────────────────────────
 * Es la misma RPC, la misma validación, el mismo freno de abuso y la misma
 * pantalla de éxito. Copiarlo para salones habría sido tener dos formularios que
 * arrancan idénticos y se separan solos: exactamente lo que ya pasó con las dos
 * familias de funciones de la base, que estuvieron un mes desincronizadas porque
 * una nunca se conectó.
 *
 * ── LAS TRES DECISIONES DE ORIGEN, QUE SIGUEN VALIENDO ──────────────────────
 *   1. EL NOMBRE ES OBLIGATORIO. Una consulta sin nombre es un mail anónimo, y a
 *      eso nadie contesta.
 *   2. EL MAIL NO SE PUEDE AUTOCOMPLETAR. Acá no hay sesión de dónde sacarlo, y
 *      es lo único sin lo cual la consulta no existe.
 *   3. EL ÉXITO NO ES UN TOAST, ES UNA PANTALLA. Un toast dura tres segundos y
 *      se lo pierde cualquiera que estaba mirando el teléfono de reojo.
 *
 * ── DE DÓNDE SALE LA ACCIÓN ─────────────────────────────────────────────────
 * `consultarPublico` sigue viviendo en `app/servicios/actions.ts` y no se mudó a
 * propósito: es UNA sola acción, con UN solo freno de abuso, y moverla habría
 * tocado la vidriera de proveedores que ya está en vivo y probada. Que el import
 * cruce carpetas es más barato que tener dos puertas de entrada al mismo INSERT.
 */

import { useState } from "react";
import Link from "next/link";
import { Send, Check } from "lucide-react";
import {
  camposAMostrar,
  validarRespuestas,
  aRespuestas,
  TOPES,
  type CampoFormulario,
} from "@/lib/formulario-consulta";
import { consultarPublico } from "@/app/servicios/actions";

const inputCls =
  "w-full min-h-[52px] bg-[#0a0a0a] border border-[#1a1a1a] focus:border-[#0047ff] outline-none text-[16px] text-[#f5f5f5] px-4 py-3 rounded-none transition-colors [color-scheme:dark]";

const labelCls = "label-tech text-[10px] uppercase tracking-[0.2em] text-[#8a8a8a]";

function Campo({
  campo,
  valor,
  onChange,
}: {
  campo: CampoFormulario;
  valor: string;
  onChange: (v: string) => void;
}) {
  const comun = {
    id: campo.id,
    value: valor,
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    ) => onChange(e.target.value),
    className: inputCls,
  };

  return (
    <label className="flex flex-col gap-2" htmlFor={campo.id}>
      <span className={labelCls}>
        {campo.label}
        {campo.requerido ? <span className="text-[#0047ff]"> *</span> : null}
      </span>

      {campo.tipo === "parrafo" ? (
        <textarea {...comun} rows={4} maxLength={TOPES.MAX_RESPUESTA} />
      ) : campo.tipo === "opciones" ? (
        <select {...comun} className={`${inputCls} appearance-none`}>
          <option value="">Elegí una opción</option>
          {campo.opciones.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...comun}
          type={campo.tipo === "fecha" ? "date" : campo.tipo === "numero" ? "number" : "text"}
          inputMode={campo.tipo === "numero" ? "numeric" : undefined}
          maxLength={campo.tipo === "texto" ? TOPES.MAX_RESPUESTA : undefined}
        />
      )}
    </label>
  );
}

export function ConsultaPublicaForm({
  profileId,
  nombreProveedor,
  campos: camposCrudos,
  intro,
  volverHref = "/servicios",
  volverTexto = "Pedirle a otro también",
  titulo = "Contale qué necesitás",
}: {
  profileId: string;
  /** Cómo se llama a quién se le escribe. Se usa tal cual en tres frases. */
  nombreProveedor: string;
  campos: CampoFormulario[];
  intro: string | null;
  /** A dónde vuelve después de mandar. Cada vidriera a la suya. */
  volverHref?: string;
  volverTexto?: string;
  titulo?: string;
}) {
  const campos = camposAMostrar(camposCrudos);

  const [valores, setValores] = useState<Record<string, string>>({});
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<{ mailEnviado: boolean } | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setError(null);

    const falta = validarRespuestas(campos, valores);
    if (falta) {
      setError(falta);
      return;
    }
    if (!nombre.trim()) {
      setError("Poné tu nombre para que sepan quién les escribe.");
      return;
    }
    if (!email.trim()) {
      setError("Poné tu mail para que te puedan contestar.");
      return;
    }

    const respuestas = aRespuestas(campos, valores);
    if (respuestas.length === 0) {
      setError("Completá al menos una pregunta antes de mandar.");
      return;
    }

    // try/finally y no tres líneas sueltas: si el await tira, sin el finally el
    // botón queda deshabilitado para siempre y la persona no puede ni reintentar
    // ni salir. Es el mismo encierro que dejó a alguien en "Subiendo tu CV…".
    setEnviando(true);
    try {
      const r = await consultarPublico({ profileId, respuestas, nombre, email, telefono });
      if (!r.ok) {
        setError(r.error ?? "No se pudo enviar. Probá de nuevo.");
        return;
      }
      setListo({ mailEnviado: Boolean(r.mailEnviado) });
    } catch {
      setError("No se pudo enviar. Probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (listo) {
    return (
      <div className="flex flex-col gap-5" role="status">
        <span className="inline-flex items-center gap-2 label-tech text-[11px] uppercase tracking-[0.2em] text-[#0047ff]">
          <Check size={16} aria-hidden="true" />
          Consulta enviada
        </span>
        <h2 className="font-[family-name:var(--font-syne)] text-[26px] md:text-[32px] font-bold uppercase tracking-tight leading-[1.05]">
          Listo, {nombre.trim().split(" ")[0]}.
        </h2>
        {/* Se le dice la verdad. Si el mail no salió, la consulta igual quedó
         *  guardada y alguien de SOMOS DER la ve, así que la persona no queda
         *  esperando algo que no va a pasar. */}
        <p className="text-[16px] leading-[1.7] text-[#8a8a8a]">
          {listo.mailEnviado
            ? `Le mandamos tu consulta a ${nombreProveedor} con tus datos. Te va a contestar por mail, a ${email.trim()}.`
            : `Guardamos tu consulta para ${nombreProveedor}, pero el mail no llegó a salir. La vemos igual desde acá y te contactamos nosotros a ${email.trim()}.`}
        </p>
        <p className="text-[14px] leading-[1.6] text-[#8a8a8a] border-l-2 border-[#1a1a1a] pl-4">
          Si en un par de días no ves nada, revisá el correo no deseado. Es donde
          suelen caer las respuestas de un remitente nuevo.
        </p>
        <Link
          href={volverHref}
          className="mt-2 self-start inline-flex items-center justify-center border border-[#f5f5f5] text-[#f5f5f5] px-8 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:border-[#0047ff] hover:text-[#0047ff] transition-colors duration-300"
        >
          {volverTexto}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="label-tech text-[11px] tracking-[0.25em] text-[#0047ff]">
          Pedir presupuesto
        </span>
        <h2 className="font-[family-name:var(--font-syne)] text-[26px] md:text-[32px] font-bold uppercase tracking-tight leading-[1.05]">
          {titulo}
        </h2>
        <p className="text-[15px] leading-[1.65] text-[#8a8a8a]">
          Le llega a su mail y te contesta directo. No hace falta crear cuenta ni
          dejar ningún dato de más.
        </p>
      </div>

      {intro?.trim() ? (
        <p className="text-[15px] text-[#cfc4c5] leading-[1.6] border-l-2 border-[#0047ff] pl-4">
          {intro}
        </p>
      ) : null}

      {campos.map((c) => (
        <Campo
          key={c.id}
          campo={c}
          valor={valores[c.id] ?? ""}
          onChange={(v) => setValores((p) => ({ ...p, [c.id]: v }))}
        />
      ))}

      <div className="flex flex-col gap-6 pt-6 border-t border-[#1a1a1a]">
        <span className={labelCls}>Para que te pueda contestar</span>

        <label className="flex flex-col gap-2" htmlFor="cp_nombre">
          <span className={labelCls}>
            Tu nombre <span className="text-[#0047ff]">*</span>
          </span>
          <input
            id="cp_nombre"
            className={inputCls}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={160}
            autoComplete="name"
            required
          />
        </label>

        <label className="flex flex-col gap-2" htmlFor="cp_email">
          <span className={labelCls}>
            Tu mail <span className="text-[#0047ff]">*</span>
          </span>
          <input
            id="cp_email"
            type="email"
            className={inputCls}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label className="flex flex-col gap-2" htmlFor="cp_tel">
          <span className={labelCls}>Tu teléfono (opcional)</span>
          <input
            id="cp_tel"
            type="tel"
            className={inputCls}
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            maxLength={40}
            autoComplete="tel"
          />
        </label>
      </div>

      {error ? (
        <p role="alert" className="text-[15px] leading-[1.6] text-[#ff8a8a]">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={enviando}
        className="inline-flex items-center justify-center gap-2 bg-[#f5f5f5] text-black px-8 py-5 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:bg-[#0047ff] hover:text-white transition-colors duration-300 disabled:opacity-50"
      >
        <Send size={16} aria-hidden="true" />
        {enviando ? "Mandando…" : "Mandar la consulta"}
      </button>

      <p className="text-[13px] leading-[1.6] text-[#8a8a8a]">
        Tus datos se los pasamos solamente a {nombreProveedor}, para que pueda
        contestarte. No los publicamos ni se los damos a nadie más.
      </p>
    </form>
  );
}
