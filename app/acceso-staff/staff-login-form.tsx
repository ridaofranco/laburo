"use client";

/**
 * Login del lado STAFF (fork "staff con cuenta"). Igual estética que el login del
 * productor, pero con shouldCreateUser:true: el staff todavía no tiene cuenta en
 * auth.users, así que al pedir el link se le crea (el email lo verifica el propio
 * link/Google). Después del login, /auth/callback rutea por identidad: si el email
 * matchea un perfil de staff → /panel-staff; si no, no puede hacer nada (gate).
 * El email es la frontera: solo entra quien controla su casilla.
 */

import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { requestStaffMagicLink, requestPasswordSetup, signInWithPassword } from "./actions";
import { LaburoWordmark } from "@/components/laburo-wordmark";

/**
 * ⭐⭐ POR QUÉ TE REBOTARON A ESTA PANTALLA (1/8).
 *
 * Tres caminos distintos terminan devolviendo a la persona acá con un parámetro
 * en la URL que explica qué pasó, y hasta hoy NADIE LO LEÍA. El parámetro
 * llegaba y la pantalla se mostraba igual que siempre, en blanco.
 *
 *   ?e=nostaff          → entró bien (con Google o con el link) pero su email no
 *                         tiene ficha en el pool. La sesión existe, el acceso no.
 *   ?motivo=link_vencido → el link para definir la contraseña ya se usó o venció.
 *   ?motivo=link_invalido→ el link llegó cortado o mal pegado.
 *
 * Los tres se veían idénticos: volvés al login y no pasa nada. Del lado de la
 * persona eso se lee como "no me deja entrar", que es textual lo que reportó
 * Franco de su propia cuenta y lo que reportó una trabajadora el 1/8.
 *
 * OJO CON LA ENUMERACIÓN: el mensaje de `nostaff` NO confirma ni desmiente que
 * un mail esté en el pool, porque para verlo hay que haber entrado ya a esa
 * casilla. O sea que quien lo lee ya probó que es dueño de ese mail. No es un
 * oráculo, y por eso acá sí se puede ser explícito.
 */
const MOTIVOS: Record<string, string> = {
  nostaff:
    "Entraste bien, pero ese email todavía no está en el pool de staff. Registrate acá abajo con ese mismo mail y ya vas a poder ver tu perfil.",
  link_vencido:
    "Ese link ya se usó o venció. Pedí uno nuevo con el botón de abajo que dice que es tu primera vez.",
  link_invalido:
    "Ese link llegó incompleto. Copialo entero desde el mail, o pedí uno nuevo con el botón de abajo.",
};

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
/** El cartel que explica por qué la persona volvió a esta pantalla. */
function Rebote({ texto }: { texto: string }) {
  return (
    <div
      role="status"
      className="w-full mb-8 border-l-2 border-[#0047ff] bg-[#0e0e0e] px-5 py-4"
    >
      <p className="text-[14px] leading-[1.6] text-[#e5e2e1]">{texto}</p>
    </div>
  );
}

/** Logo oficial de Google, en SVG, para el botón de entrar con Google. */
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

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
  /** El "por qué volviste acá", leído de la URL (ver MOTIVOS). */
  const [rebote, setRebote] = useState<string | null>(null);

  // Se lee en el cliente y no con useSearchParams a propósito: useSearchParams
  // obliga a envolver todo en <Suspense> y esta es la pantalla de entrada, no
  // queremos meterle un boundary por un cartel. Un efecto sin dependencias
  // alcanza: el parámetro no cambia sin recargar.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const clave = p.get("motivo") ?? p.get("e") ?? "";
    setRebote(MOTIVOS[clave] ?? null);
  }, []);

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
        <motion.h1 {...up(0)} className="mb-4">
          <LaburoWordmark className="h-[64px] md:h-[88px] w-auto" priority />
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

        {/* Por qué volviste acá. Va ARRIBA de todo, antes del formulario: si
            rebotaste, lo primero que necesitás es saber qué pasó, no otro campo
            para llenar. */}
        {rebote ? (
          <motion.div {...up(0.08)} className="w-full">
            <Rebote texto={rebote} />
          </motion.div>
        ) : null}

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

            {/* ⭐ GOOGLE ES UN BOTÓN, NO LETRA CHICA (1/8).
                Estaba, y andaba, pero se veía EXACTAMENTE igual que los otros
                dos links grises del pie ("Entrar con un link a mi mail" y "¿Sos
                productor?"): 12px, gris, sin logo, apilado al fondo. Franco,
                que conoce la app, preguntó por qué LABURO no tenía login con
                Google. Si el dueño no lo encuentra, nadie lo encuentra.
                Va con el LOGO OFICIAL, como manda la regla de marca: la gente
                reconoce el logo, no la palabra. */}
            <div className="w-full flex items-center gap-4 py-1" aria-hidden="true">
              <span className="h-px flex-1 bg-[#4c4546]/60" />
              <span className="font-[family-name:var(--font-geist)] text-[11px] uppercase tracking-[0.2em] text-[#8a8a8a]">
                o
              </span>
              <span className="h-px flex-1 bg-[#4c4546]/60" />
            </div>
            <button
              type="button"
              onClick={handleGoogle}
              className="w-full border border-[#4c4546] bg-transparent text-[#e5e2e1] py-5 px-8 flex items-center justify-center gap-3 hover:border-[#e5e2e1] transition-colors duration-150 cursor-pointer"
            >
              <GoogleLogo />
              <span className="font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.2em]">
                Entrar con Google
              </span>
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
