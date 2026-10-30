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

import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { enviarLeadProductor } from "./actions";
import { revisarAntesDeEnviar } from "@/lib/revisar-email";

const labelCls =
  "block mb-2 font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.1em] text-[#8a8a8a] transition-colors group-focus-within:text-[#f5f5f5]";
const inputCls =
  "w-full bg-transparent border-0 border-b border-[#2a2a2a] focus:border-[#f5f5f5] outline-none text-[17px] leading-[1.6] text-[#f5f5f5] py-3 px-0 rounded-none transition-colors duration-300 placeholder:text-[#565656]";

/*
 * Si se publica una versión nueva mientras alguien tiene la página abierta, el
 * envío falla con «Failed to find Server Action» (Vercel: 3 veces, la última el
 * 29/10) y antes la excepción tiraba la página entera: la consulta se perdía.
 * Ahora se guarda lo escrito, se recarga UNA vez (con la versión nueva) y se
 * devuelve cargado para tocar Enviar de nuevo.
 */
const GUARDADO = "laburo-lead-pendiente";
// Marca que ya se recargó una vez en esta pestaña: nunca entra en un bucle.
const RECARGADO = "laburo-lead-recargado";
const CAMPOS = ["nombre", "email", "telefono", "empresa", "mensaje"] as const;

export function LeadForm() {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Último mail dudoso que se le corrigió: si lo vuelve a poner, pasa. */
  const emailInsistido = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let guardado: Record<string, string> | null = null;
    try {
      const crudo = sessionStorage.getItem(GUARDADO);
      sessionStorage.removeItem(GUARDADO);
      if (crudo) guardado = JSON.parse(crudo);
    } catch {
      return;
    }
    const form = formRef.current;
    if (!guardado || !form) return;
    for (const c of CAMPOS) {
      const el = form.elements.namedItem(c);
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.value = guardado[c] ?? "";
      }
    }
    setError("Actualizamos la página mientras escribías. Tu consulta sigue acá: tocá Enviar de nuevo.");
    form.scrollIntoView({ block: "center" });
  }, []);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    // gmail.con, gamil.com: con el mail mal no hay cómo contestarle.
    const rev = revisarAntesDeEnviar(String(fd.get("email") ?? ""), emailInsistido);
    if ("corregir" in rev) {
      const campo = e.currentTarget.elements.namedItem("email") as HTMLInputElement | null;
      if (rev.corregir && campo) campo.value = rev.corregir;
      setError(rev.mensaje);
      return;
    }
    fd.set("email", rev.enviar);
    startTransition(async () => {
      let r: Awaited<ReturnType<typeof enviarLeadProductor>>;
      try {
        r = await enviarLeadProductor(fd);
      } catch {
        let yaRecargo = false;
        try {
          yaRecargo = sessionStorage.getItem(RECARGADO) !== null;
          if (!yaRecargo) {
            sessionStorage.setItem(RECARGADO, "1");
            const datos: Record<string, string> = {};
            for (const c of CAMPOS) datos[c] = String(fd.get(c) ?? "");
            sessionStorage.setItem(GUARDADO, JSON.stringify(datos));
          }
        } catch {
          yaRecargo = true;
        }
        if (!yaRecargo) {
          window.location.reload();
          return;
        }
        setError("No pudimos enviar tu consulta. Revisá tu conexión y probá de nuevo.");
        return;
      }
      if (r.ok) {
        setSent(true);
      } else setError(r.reason ?? "No pudimos enviar tu consulta. Probá de nuevo.");
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
    // ⚠️ `method="post"` NO ES DECORATIVO, aunque el envío real lo haga onSubmit.
    // Si alguien completa y aprieta enviar ANTES de que React hidrate (JS lento,
    // conexión mala, o simplemente rápido), el navegador hace el submit nativo.
    // Sin `method`, ese submit por defecto es un GET: los datos se van a la
    // barra de direcciones, y con ellos el nombre, el mail y el teléfono de la
    // persona. Comprobado el 7/9/2026 en una prueba automatizada: la consulta se
    // perdía sin decir nada Y Vercel Analytics registraba la URL completa, con
    // los datos personales adentro, como si fuera el nombre de una página.
    <form ref={formRef} onSubmit={onSubmit} method="post" className="flex flex-col gap-8">
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
