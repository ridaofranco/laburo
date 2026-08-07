"use client";

/**
 * Formulario de lead para productores, SIN login.
 *
 * Antes el unico CTA de la landing era "Buscar staff" -> /login, y el login
 * esta gateado por membresia: un productor nuevo chocaba contra una pared.
 * Este form es el camino comercial: deja nombre, email y que necesita, y la
 * consulta llega por mail a las casillas internas (app/landing/actions.ts).
 *
 * Mismo idioma visual que /login y /sumate: labels Geist uppercase, inputs de
 * linea (border-bottom hairline), boton ghost que pasa a solido.
 */

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { enviarLeadProductor } from "./actions";

const labelCls =
  "block mb-2 font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.1em] text-[#8a8a8a] transition-colors group-focus-within:text-[#f5f5f5]";
const inputCls =
  "w-full bg-transparent border-0 border-b border-[#2a2a2a] focus:border-[#f5f5f5] outline-none text-[17px] leading-[1.6] text-[#f5f5f5] py-3 px-0 rounded-none transition-colors duration-300 placeholder:text-[#565656]";

export function LeadForm() {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const r = await enviarLeadProductor(fd);
      if (r.ok) setSent(true);
      else setError(r.reason ?? "No pudimos enviar tu consulta. Probá de nuevo.");
    });
  }

  if (sent) {
    return (
      <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-10 md:p-14 text-center">
        <CheckCircle2 size={48} className="text-[#3dd68c] mx-auto mb-6" strokeWidth={1.5} />
        <h3 className="font-[family-name:var(--font-syne)] text-[26px] md:text-[32px] font-bold uppercase tracking-tight text-[#f5f5f5]">
          Consulta recibida
        </h3>
        <p className="text-[16px] leading-[1.7] text-[#8a8a8a] mt-4 max-w-[420px] mx-auto">
          Te escribimos a la casilla que dejaste para coordinar los próximos
          pasos. Revisá también el correo no deseado, por las dudas.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8">
      {/* Honeypot anti-bots: invisible para humanos, tentador para scripts. */}
      <input
        type="text"
        name="sitio"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
        <div className="group">
          <label htmlFor="lead-nombre" className={labelCls}>
            Nombre *
          </label>
          <input id="lead-nombre" name="nombre" required maxLength={120} className={inputCls} />
        </div>
        <div className="group">
          <label htmlFor="lead-email" className={labelCls}>
            Email *
          </label>
          <input id="lead-email" name="email" type="email" required maxLength={200} className={inputCls} />
        </div>
        <div className="group">
          <label htmlFor="lead-telefono" className={labelCls}>
            Teléfono / WhatsApp
          </label>
          <input
            id="lead-telefono"
            name="telefono"
            maxLength={60}
            placeholder="+54 11 5555 5555"
            className={inputCls}
          />
        </div>
        <div className="group">
          <label htmlFor="lead-empresa" className={labelCls}>
            Productora / empresa
          </label>
          <input id="lead-empresa" name="empresa" maxLength={160} className={inputCls} />
        </div>
      </div>

      {/* El ejemplo pide staff Y otra cosa a proposito (7/8): con el ejemplo
       * anterior ("10 mozos y 4 de seguridad") el que entraba buscando un salon
       * o un proveedor leia que este formulario no era para el. */}
      <div className="group">
        <label htmlFor="lead-mensaje" className={labelCls}>
          Qué necesitás *
        </label>
        <textarea
          id="lead-mensaje"
          name="mensaje"
          required
          maxLength={2000}
          rows={4}
          placeholder="Ej: 10 mozos y 4 de seguridad para el 20/9 en CABA, y estoy buscando salón para 200 personas."
          className={`${inputCls} resize-none`}
        />
      </div>

      {error && (
        <p role="alert" className="text-[14px] leading-[1.6] text-[#f0555c]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start border border-[#f5f5f5] bg-transparent text-[#f5f5f5] px-12 py-5 hover:bg-[#0047ff] hover:border-[#0047ff] hover:text-white transition-colors duration-150 cursor-pointer disabled:opacity-50"
      >
        <span className="font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.2em]">
          {pending ? "Enviando…" : "Enviar consulta"}
        </span>
      </button>

      <p className="text-[12px] leading-[1.6] text-[#565656] max-w-[520px]">
        Usamos estos datos solo para responderte por esta consulta. No van a
        ninguna lista.
      </p>
    </form>
  );
}
