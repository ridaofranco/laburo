"use client";

/**
 * Login del lado STAFF (fork "staff con cuenta"). Igual estética que el login del
 * productor, pero con shouldCreateUser:true: el staff todavía no tiene cuenta en
 * auth.users, así que al pedir el link se le crea (el email lo verifica el propio
 * link/Google). Después del login, /auth/callback rutea por identidad: si el email
 * matchea un perfil de staff → /panel-staff; si no, no puede hacer nada (gate).
 * El email es la frontera: solo entra quien controla su casilla.
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { requestStaffMagicLink, requestPasswordSetup, signInWithPassword } from "./actions";

/**
 * ⭐ ACCESO CON CONTRASEÑA (decisión de Franco, 26/7).
 *
 * Antes esta pantalla era solo "poné tu mail y te mandamos un link". El link lo
 * mandaba Supabase con su plantilla por defecto: en inglés, sin marca y sin
 * logo. Franco: "es horrible y me quita credibilidad". Y el problema real es más
 * grave que lo estético: quien recibe la bienvenida linda de LABURO y después
 * ESO, piensa que es phishing y no entra.
 *
 * Ahora la puerta principal es mail + contraseña, y el link por mail queda como
 * salida para el que no se la acuerda. Se mantienen las dos a propósito: el
 * staff entra dos o tres veces al año, y una contraseña que no se usa nunca se
 * olvida siempre. Sacar el link sería garantizar que media tanda quede afuera.
 */

const up = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] as const, delay },
});

/** Qué está mostrando la pantalla. */
type Vista = "clave" | "link" | "mandado" | "clave-mandada";

/**
 * El camino del que NO tiene ficha (decisión de Franco, 28/7; ampliada el 31/7).
 * El registro de staff está abierto a cualquiera, así que esta pantalla nunca
 * puede ser un callejón sin salida.
 *
 * Desde el 31/7 la salida principal está ARRIBA del formulario (ver
 * SalidaSumate): el que llega sin ficha la ve sin scrollear, antes de intentar
 * entrar y frustrarse. Esta invitación se queda para el momento de después de
 * mandar el pedido, que es cuando el que no está en el pool más la necesita.
 *
 * Lo que no cambia, y no puede cambiar: el mensaje es SIEMPRE el mismo, esté o
 * no el mail en el pool. Sin oráculo de enumeración. Este texto está escrito
 * para servirle igual a los dos, así que no dice ni sugiere que a alguien le
 * falte la ficha.
 */
function InvitacionSumate() {
  return (
    <div className="mt-12 pt-10 border-t border-[#4c4546]/60 w-full flex flex-col items-center gap-6">
      <p className="text-center text-[14px] leading-[1.6] text-[#988e90]">
        ¿Todavía no te sumaste? Registrate con este mismo email. Alcanza con
        adjuntar tu CV y quedás en el pool de staff.
      </p>
      <a
        href="/sumate"
        className="border border-[#e5e2e1] text-[#e5e2e1] px-8 py-4 flex items-center gap-3 hover:bg-[#e5e2e1] hover:text-black transition-colors duration-150 font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.2em]"
      >
        Sumate con tu CV
        <ArrowRight size={16} strokeWidth={1.5} />
      </a>
    </div>
  );
}

/**
 * La salida protagonista, arriba de todo (decisión de Franco, 31/7). Antes vivía
 * al pie, después del submit, de los dos botones de cambio de modo y del de
 * Google: el que caía acá sin ficha no la veía nunca. No hace ninguna consulta,
 * no toca actions.ts y su texto es idéntico para el que está en el pool y para
 * el que no: es una invitación abierta, no una respuesta sobre un mail.
 */
function SalidaSumate() {
  return (
    <div className="w-full flex flex-col items-center gap-4 mb-10">
      <p className="text-center text-[14px] leading-[1.6] text-[#cfc4c5]">
        ¿Primera vez acá? Sumate al pool con tu CV. No hace falta que llenes
        nada, solo adjuntarlo.
      </p>
      <a
        href="/sumate"
        className="w-full border border-[#e5e2e1] text-[#e5e2e1] px-8 py-4 flex items-center justify-center gap-3 hover:bg-[#e5e2e1] hover:text-black transition-colors duration-150 font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.2em]"
      >
        Sumate con tu CV
        <ArrowRight size={16} strokeWidth={1.5} />
      </a>
      <div className="w-full flex items-center gap-4 pt-1" aria-hidden="true">
        <span className="h-px flex-1 bg-[#4c4546]/60" />
        <span className="font-[family-name:var(--font-geist)] text-[11px] uppercase tracking-[0.2em] text-[#8a8a8a]">
          o
        </span>
        <span className="h-px flex-1 bg-[#4c4546]/60" />
      </div>
      <p className="text-center text-[13px] leading-[1.5] text-[#8a8a8a]">
        ¿Ya estás en el pool? Entrá con tu cuenta.
      </p>
    </div>
  );
}

export function StaffLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [vista, setVista] = useState<Vista>("clave");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callbackUrl = () => `${window.location.origin}/auth/callback`;

  /** Las dos vistas donde todavía hay un formulario para llenar. */
  const enFormulario = !sent && vista !== "mandado" && vista !== "clave-mandada";

  /** Entrar con mail y contraseña. */
  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    try {
      const r = await signInWithPassword(email, password);
      if (!r.ok) {
        setError(r.error ?? "No pudimos entrar.");
        return;
      }
      // El ruteo por identidad (staff → /panel-staff, productor → /dashboard) lo
      // hace /auth/callback, así que se pasa por ahí en vez de adivinar acá.
      window.location.href = "/auth/callback?from=password";
    } catch {
      setError("No pudimos entrar. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  /** Pedir el mail para crear la contraseña (o cambiarla si se la olvidó). */
  const handleCrearClave = async () => {
    if (!email) {
      setError("Escribí tu email y volvé a tocar acá.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await requestPasswordSetup(email);
      setVista("clave-mandada");
    } catch {
      setError("No pudimos procesar el pedido. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    if (error) toast.error("No pudimos iniciar sesión. Probá de nuevo.");
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    // El envío pasa por el server: valida el email contra el pool (service-role)
    // ANTES de mandar el OTP. Respuesta uniforme = sin oráculo de enumeración, así
    // que mostramos siempre la misma pantalla, esté o no en el pool.
    try {
      await requestStaffMagicLink(email);
      setSent(true);
    } catch {
      toast.error("No pudimos procesar el pedido. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-dvh flex flex-col items-center justify-center overflow-hidden bg-black text-[#e5e2e1] px-6">
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none hidden md:grid grid-cols-12 gap-8 px-20 opacity-[0.04] z-0"
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="border-r border-[#4c4546] h-full" />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-[448px] flex flex-col items-center">
        <motion.h1
          {...up(0)}
          className="font-lockup text-[64px] md:text-[88px] leading-none text-[#e5e2e1] mb-4 select-none"
        >
          LABURO.
        </motion.h1>
        <motion.p
          {...up(0.05)}
          className={`label-tech text-[12px] uppercase tracking-[0.3em] text-[#cfc4c5] ${
            // Con la salida a /sumate arriba, el aire de siempre empujaba el campo
            // de email fuera de la pantalla en 390px. Se achica solo donde hay
            // formulario; en las pantallas de resultado queda como estaba.
            enFormulario ? "mb-10 md:mb-16" : "mb-[64px] md:mb-[96px]"
          }`}
        >
          Portal de Staff
        </motion.p>

        {enFormulario ? (
          <motion.div {...up(0.12)} className="w-full">
            <SalidaSumate />
          </motion.div>
        ) : null}

        {vista === "mandado" || sent ? (
          <motion.div {...up(0.1)} className="w-full flex flex-col items-center">
            <p className="text-center text-[16px] leading-[1.6] text-[#cfc4c5]">
              Si <span className="text-[#e5e2e1]">{email}</span> está registrado
              en nuestro pool de staff, te mandamos un link para entrar. Revisá
              tu casilla, y si no lo ves, mirá en spam.
            </p>
            <InvitacionSumate />
          </motion.div>
        ) : vista === "clave-mandada" ? (
          <motion.div {...up(0.1)} className="w-full flex flex-col items-center">
            <p className="text-center text-[16px] leading-[1.6] text-[#cfc4c5]">
              Si <span className="text-[#e5e2e1]">{email}</span> está registrado
              en nuestro pool de staff, te mandamos un link para crear tu
              contraseña. Revisá tu casilla, y si no lo ves, mirá en spam.
            </p>
            <InvitacionSumate />
          </motion.div>
        ) : (
          <motion.form
            {...up(0.2)}
            onSubmit={vista === "clave" ? handlePassword : handleMagicLink}
            className="w-full flex flex-col gap-10"
          >
            <div className="relative w-full group">
              <label
                htmlFor="email"
                className="block mb-2 font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.1em] text-[#cfc4c5] transition-colors group-focus-within:text-[#e5e2e1]"
              >
                Tu correo electrónico
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=" "
                className="w-full bg-transparent border-0 border-b border-[#4c4546] focus:border-[#e5e2e1] outline-none text-[18px] leading-[1.6] text-[#e5e2e1] py-4 px-0 rounded-none transition-colors duration-300"
              />
              <p className="mt-3 text-[13px] text-[#8a8a8a] leading-[1.5]">
                Usá el mismo email con el que te postulaste.
              </p>
            </div>

            {vista === "clave" ? (
              <div className="relative w-full group">
                <label
                  htmlFor="password"
                  className="block mb-2 font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.1em] text-[#cfc4c5] transition-colors group-focus-within:text-[#e5e2e1]"
                >
                  Tu contraseña
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent border-0 border-b border-[#4c4546] focus:border-[#e5e2e1] outline-none text-[18px] leading-[1.6] text-[#e5e2e1] py-4 px-0 rounded-none transition-colors duration-300"
                />
                <button
                  type="button"
                  onClick={handleCrearClave}
                  disabled={loading}
                  className="mt-3 font-[family-name:var(--font-geist)] text-[13px] text-[#988e90] hover:text-[#e5e2e1] transition-colors underline underline-offset-4 disabled:opacity-50"
                >
                  Es mi primera vez, o no me acuerdo la contraseña
                </button>
              </div>
            ) : (
              <p className="text-[13px] text-[#8a8a8a] leading-[1.5] -mt-4">
                Te mandamos un link para entrar, sin contraseña. Sirve para esta
                vez nada más.
              </p>
            )}

            {error ? (
              <p role="alert" className="text-[14px] leading-[1.5] text-[#ff8a8a]">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full border border-[#e5e2e1] bg-transparent text-[#e5e2e1] py-6 px-8 flex items-center justify-center gap-4 hover:bg-[#e5e2e1] hover:text-black transition-colors duration-150 cursor-pointer disabled:opacity-50"
            >
              <span className="font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.2em]">
                {loading ? "Un segundo…" : vista === "clave" ? "Entrar" : "Mandame el link"}
              </span>
              <ArrowRight size={18} strokeWidth={1.5} />
            </button>

            {/* La salida para el que no se acuerda nada. El staff entra dos o tres
                veces al año: sin esto, media tanda queda afuera. */}
            <button
              type="button"
              onClick={() => { setVista(vista === "clave" ? "link" : "clave"); setError(null); }}
              className="mx-auto font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.1em] text-[#988e90] hover:text-[#e5e2e1] transition-colors"
            >
              {vista === "clave" ? "Entrar con un link a mi mail" : "Entrar con mi contraseña"}
            </button>

            <button
              type="button"
              onClick={handleGoogle}
              className="mx-auto font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.1em] text-[#988e90] hover:text-[#e5e2e1] transition-colors"
            >
              Entrar con Google
            </button>

            {/* La salida a /sumate ya no vive acá abajo: subió arriba del
                formulario (SalidaSumate), que es donde el que llega sin ficha la
                ve sin scrollear. */}
            <a
              href="/login"
              className="mx-auto font-[family-name:var(--font-geist)] text-[11px] uppercase tracking-[0.1em] text-[#8a8a8a] hover:text-[#cfc4c5] transition-colors"
            >
              ¿Sos productor? Ingresá acá
            </a>
          </motion.form>
        )}
      </div>
    </main>
  );
}
