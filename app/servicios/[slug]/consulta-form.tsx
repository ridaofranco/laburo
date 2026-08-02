"use client";

/**
 * El formulario con el que un cliente final le pide presupuesto a un proveedor.
 *
 * Es el mismo motor que el diálogo de /proveedores (mismos campos, misma
 * validación de lib/formulario-consulta.ts, misma RPC del lado del proveedor),
 * con tres diferencias que vienen de quién lo está completando:
 *
 *   1. EL NOMBRE ES OBLIGATORIO. En la versión de la productora podía ir vacío
 *      porque el mail decía "tal productora te está pidiendo un presupuesto" y
 *      con eso el proveedor ya sabía con quién trataba. Acá no hay nada atrás:
 *      una consulta sin nombre es un mail anónimo, y a eso nadie contesta.
 *
 *   2. EL MAIL NO SE PUEDE AUTOCOMPLETAR. La productora tenía cuenta y se le
 *      ponía el suyo. Acá no hay sesión de dónde sacarlo, así que se pide, y es
 *      lo único sin lo cual la consulta no existe: sin mail el proveedor no
 *      tiene a dónde contestar.
 *
 *   3. EL ÉXITO NO ES UN TOAST, ES UNA PANTALLA. Un toast dura tres segundos y
 *      se lo pierde cualquiera que estaba mirando el teléfono de reojo. Esta
 *      persona necesita saber, sin lugar a dudas, que su consulta salió y que la
 *      respuesta le va a llegar por mail (y que revise el spam, que es donde
 *      terminan la mitad).
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
import { consultarPublico } from "../actions";

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
}: {
  profileId: string;
  nombreProveedor: string;
  campos: CampoFormulario[];
  intro: string | null;
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

    setEnviando(true);
    const r = await consultarPublico({ profileId, respuestas, nombre, email, telefono });
    setEnviando(false);

    if (!r.ok) {
      setError(r.error ?? "No se pudo enviar. Probá de nuevo.");
      return;
    }
    setListo({ mailEnviado: Boolean(r.mailEnviado) });
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
          href="/servicios"
          className="mt-2 self-start inline-flex items-center justify-center border border-[#f5f5f5] text-[#f5f5f5] px-8 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:border-[#0047ff] hover:text-[#0047ff] transition-colors duration-300"
        >
          Pedirle a otro también
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
          Contale qué necesitás
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
