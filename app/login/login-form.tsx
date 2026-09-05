"use client";

/**
 * Login de LABURO — porteo FIEL de la pantalla Stitch "LABURO - Acceso"
 * (Minimalista Radical), con la lógica real intacta (magic link + Google OAuth,
 * shouldCreateUser:false → solo los admin de Franco). Estilos exactos de Stitch
 * en valores arbitrarios (self-contained): negro absoluto, wordmark Syne, label
 * Geist, input hairline bottom-border, botón ghost→sólido. Grilla estructural de
 * fondo (opacity 0.03) como en Stitch. Motion para el fade-in-up con stagger.
 */

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { signInWithPassword } from "@/lib/auth-password";
// El envío del link vive en el server action de /entrar, compartido por las dos
// puertas a propósito: necesita la service-role key (o sea que no puede correr
// en el navegador) y duplicarlo es exactamente el error que este repo ya cometió
// dos veces, arreglando el lado del staff y dejando roto el del productor.
import { pedirLinkDeAcceso } from "@/app/entrar/actions";
import { LaburoWordmark } from "@/components/laburo-wordmark";
import { GoogleLogo } from "@/components/google-logo";

const up = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] as const, delay },
});

/**
 * POR QUÉ VOLVISTE A ESTA PANTALLA (1/8), igual que en /acceso-staff.
 *
 * /auth/callback devuelve al productor acá cuando el canje del link falla o
 * cuando no hay sesión, y hasta hoy lo hacía MUDO: volvías al login y no pasaba
 * nada. Es el mismo problema que tenía el lado del staff, y no se puede arreglar
 * en una puerta sola.
 */
const MOTIVOS: Record<string, string> = {
  link_vencido:
    "Ese link de acceso ya se usó o venció. Pedí uno nuevo escribiendo tu mail acá abajo.",
  sin_sesion:
    "Se cerró tu sesión antes de terminar de entrar. Probá de nuevo desde acá.",
};

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [rebote, setRebote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setRebote(MOTIVOS[p.get("motivo") ?? ""] ?? null);
  }, []);

  const callbackUrl = () => `${window.location.origin}/auth/callback`;

  const handleGoogleLogin = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    if (error) toast.error("No pudimos iniciar sesión. Probá de nuevo.");
  };

  /**
   * ⭐ UNA SOLA PUERTA, DOS FORMAS DE PASAR (3/8).
   *
   * Hasta hoy esta pantalla no tenía campo de contraseña: solo Google y magic
   * link. Y el mail de bienvenida de la productora le decía textual *"después
   * entrás siempre con este mismo mail y esa clave"*. O sea que la clave que
   * acababa de elegir no se podía usar en ningún lado, porque
   * `signInWithPassword` vivía únicamente del lado del staff.
   *
   * Con contraseña escrita, entra con ella. Vacía, sigue mandando el link como
   * siempre: el que nunca definió una no perdió su camino.
   */
  const handleEntrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setError(null);

    if (password) {
      setLoading(true);
      const r = await signInWithPassword(email, password);
      setLoading(false);
      if (!r.ok) {
        setError(r.error ?? "No pudimos entrar.");
        return;
      }
      // Igual que en /acceso-staff: el ruteo por identidad lo hace
      // /auth/callback, no se adivina acá.
      window.location.href = "/auth/callback?from=password";
      return;
    }

    setLoading(true);
    // ⭐ EL ENVÍO SE MUDÓ AL SERVIDOR EL 2/9, por el link que vencía siendo
    // válido: el mail de Supabase traía un `code` de PKCE que solo se canjeaba
    // en el mismo navegador que lo pidió. Ahora el link lo arma
    // `admin.generateLink` y viaja adentro de nuestro mail.
    //
    // El `null` es el rol: esta puerta nunca mandó `como` en su
    // `emailRedirectTo`, así que el ruteo por orden natural de /auth/callback
    // queda igual que siempre. Y con rol null el server action NO crea ninguna
    // cuenta, que es el `shouldCreateUser: false` de acá (gate LABURO, CR-01:
    // solo los admin ya existen en auth.users) dicho del lado del servidor.
    await pedirLinkDeAcceso(email, null);
    setLoading(false);
    // Respuesta SIEMPRE uniforme (decisión de Franco, 28/7): con
    // shouldCreateUser:false, Supabase devuelve error cuando la cuenta no
    // existe, y mostrar ese error era un oráculo (revelaba qué mails tienen
    // cuenta) y a la vez un callejón sin salida (silencio total para el
    // productor nuevo). Ahora se muestra la misma pantalla exista o no la
    // cuenta, y esa pantalla ofrece el camino real: la consulta de productores
    // de la landing.
    setMagicLinkSent(true);
  };

  return (
    <main className="relative min-h-dvh flex flex-col items-center justify-center overflow-hidden bg-black text-[#e5e2e1] px-6">
      {/* Grilla estructural de fondo (motif arquitectónico de Stitch) */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none hidden md:grid grid-cols-12 gap-8 px-20 opacity-[0.04] z-0"
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="border-r border-[#4c4546] h-full" />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-[448px] flex flex-col items-center">
        {/* Wordmark monumental, con el PNG oficial */}
        <motion.h1
          {...up(0)}
          className="mb-[80px] md:mb-[120px]"
        >
          <LaburoWordmark className="h-[64px] md:h-[88px] w-auto" priority />
        </motion.h1>

        {rebote ? (
          <motion.div {...up(0.08)} className="w-full">
            <div
              role="status"
              className="w-full mb-8 border-l-2 border-[#0047ff] bg-[#0e0e0e] px-5 py-4"
            >
              <p className="text-[14px] leading-[1.6] text-[#e5e2e1]">{rebote}</p>
            </div>
          </motion.div>
        ) : null}

        {magicLinkSent ? (
          <motion.div {...up(0.1)} className="w-full flex flex-col items-center">
            <p className="text-center text-[16px] leading-[1.6] text-[#cfc4c5]">
              Si tu cuenta existe, te mandamos un link de acceso a{" "}
              <span className="text-[#e5e2e1]">{email}</span>. Revisá tu casilla,
              y si no lo ves, mirá en spam.
            </p>
            <div className="mt-12 pt-10 border-t border-[#4c4546]/60 w-full flex flex-col items-center gap-6">
              <p className="text-center text-[14px] leading-[1.6] text-[#988e90]">
                ¿No te llegó? Puede que todavía no tengas cuenta. Contanos qué
                necesitás para tu evento y te contactamos.
              </p>
              <Link
                href="/#productores"
                className="border border-[#e5e2e1] text-[#e5e2e1] px-8 py-4 flex items-center gap-3 hover:bg-[#e5e2e1] hover:text-black transition-colors duration-150 font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.2em]"
              >
                Dejar mi consulta
                <ArrowRight size={16} strokeWidth={1.5} />
              </Link>
            </div>
          </motion.div>
        ) : (
          <motion.form
            {...up(0.2)}
            onSubmit={handleEntrar}
            className="w-full flex flex-col gap-12"
          >
            <div className="relative w-full group">
              <label
                htmlFor="email"
                className="block mb-2 font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.1em] text-[#cfc4c5] transition-colors group-focus-within:text-[#e5e2e1]"
              >
                Correo Electrónico
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
            </div>

            <div className="relative w-full group">
              <label
                htmlFor="password"
                className="block mb-2 font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.1em] text-[#cfc4c5] transition-colors group-focus-within:text-[#e5e2e1]"
              >
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder=" "
                className="w-full bg-transparent border-0 border-b border-[#4c4546] focus:border-[#e5e2e1] outline-none text-[18px] leading-[1.6] text-[#e5e2e1] py-4 px-0 rounded-none transition-colors duration-300"
              />
              {/* No es obligatoria a propósito: el que entra siempre con Google o
                  con el link nunca definió una, y pedírsela lo dejaría afuera. */}
              <p className="mt-3 text-[13px] text-[#8a8a8a] leading-[1.5]">
                Si todavía no tenés una, dejala vacía y te mandamos un link para
                entrar.
              </p>
            </div>

            {error ? (
              <p role="alert" className="text-[14px] leading-[1.5] text-[#ff8a8a]">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full border border-[#e5e2e1] bg-transparent text-[#e5e2e1] py-6 px-8 flex items-center justify-center gap-4 hover:bg-[#e5e2e1] hover:text-black transition-colors duration-150 cursor-pointer disabled:opacity-50"
            >
              <span className="font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.2em]">
                {loading
                  ? password ? "Entrando…" : "Enviando…"
                  : password ? "Entrar" : "Mandarme un link"}
              </span>
              <ArrowRight size={18} strokeWidth={1.5} />
            </button>

            {/* ⭐ GOOGLE ES UN BOTÓN ACÁ TAMBIÉN (1/8).
                El 1/8 se arregló el botón de Google del lado del STAFF y este
                quedó como estaba: texto gris de 12px, sin logo, indistinguible
                del "¿Trabajás en eventos?" de abajo. Franco lo marcó textual:
                "lo que hacés para empleados no lo hacés para productores".
                Tenía razón, y por eso el logo ahora es un componente
                compartido (components/google-logo.tsx) en vez de una copia. */}
            <div className="w-full flex items-center gap-4" aria-hidden="true">
              <span className="h-px flex-1 bg-[#4c4546]/60" />
              <span className="font-[family-name:var(--font-geist)] text-[11px] uppercase tracking-[0.2em] text-[#8a8a8a]">
                o
              </span>
              <span className="h-px flex-1 bg-[#4c4546]/60" />
            </div>
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full border border-[#4c4546] bg-transparent text-[#e5e2e1] py-5 px-8 flex items-center justify-center gap-3 hover:border-[#e5e2e1] transition-colors duration-150 cursor-pointer"
            >
              <GoogleLogo />
              <span className="font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.2em]">
                Entrar con Google
              </span>
            </button>

            {/* ⭐ EL CAMINO DEL PRODUCTOR SIN CUENTA, REESCRITO EL 2/8.
                Hasta hoy decia "contanos que necesitas y te contactamos": las
                cuentas no se autocreaban (decision del 28/7) y habia que
                esperar a que Franco escribiera. El 2/8 Franco lo cambio:
                "que quede abierto, ya esta, sino no tiene sentido". Ahora se
                crea la cuenta sola desde /registrar-productora. */}
            <div className="pt-8 border-t border-[#4c4546]/60 flex flex-col items-center gap-3 text-center">
              <p className="text-[13px] text-[#8a8a8a] leading-[1.5] max-w-[360px]">
                ¿Buscás staff para tu evento y todavía no tenés cuenta? Creala
                ahora, es gratis.
              </p>
              <Link
                href="/registrar-productora"
                className="font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.15em] text-[#e5e2e1] border-b border-[#4c4546] pb-1 hover:border-[#e5e2e1] transition-colors"
              >
                Crear la cuenta de mi productora
              </Link>
            </div>

            <a
              href="/acceso-staff"
              className="mx-auto font-[family-name:var(--font-geist)] text-[11px] uppercase tracking-[0.1em] text-[#8a8a8a] hover:text-[#cfc4c5] transition-colors"
            >
              ¿Trabajás en eventos? Entrá como staff
            </a>
          </motion.form>
        )}
      </div>
    </main>
  );
}
