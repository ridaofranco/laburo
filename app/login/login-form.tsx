"use client";

/**
 * Login de LABURO — porteo FIEL de la pantalla Stitch "LABURO - Acceso"
 * (Minimalista Radical), con la lógica real intacta (magic link + Google OAuth,
 * shouldCreateUser:false → solo los admin de Franco). Estilos exactos de Stitch
 * en valores arbitrarios (self-contained): negro absoluto, wordmark Syne, label
 * Geist, input hairline bottom-border, botón ghost→sólido. Grilla estructural de
 * fondo (opacity 0.03) como en Stitch. Motion para el fade-in-up con stagger.
 */

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { LaburoWordmark } from "@/components/laburo-wordmark";

const up = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] as const, delay },
});

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const callbackUrl = () => `${window.location.origin}/auth/callback`;

  const handleGoogleLogin = async () => {
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
    const supabase = createClient();
    await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl(),
        // Gate LABURO: solo los admin ya existen en auth.users (CR-01).
        shouldCreateUser: false,
      },
    });
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
            onSubmit={handleMagicLink}
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

            <button
              type="submit"
              disabled={loading}
              className="w-full border border-[#e5e2e1] bg-transparent text-[#e5e2e1] py-6 px-8 flex items-center justify-center gap-4 hover:bg-[#e5e2e1] hover:text-black transition-colors duration-150 cursor-pointer disabled:opacity-50"
            >
              <span className="font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.2em]">
                {loading ? "Enviando…" : "Acceso"}
              </span>
              <ArrowRight size={18} strokeWidth={1.5} />
            </button>

            {/* Opción Google, en el mismo registro minimalista */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="mx-auto font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.1em] text-[#988e90] hover:text-[#e5e2e1] transition-colors"
            >
              Acceder con Google
            </button>

            {/* El camino del productor SIN cuenta (decisión de Franco, 28/7):
                las cuentas de productor no se autocrean; el que quiere trabajar
                con LABURO manda una consulta por el form de la landing
                (#productores) y se lo contacta por mail. */}
            <div className="pt-8 border-t border-[#4c4546]/60 flex flex-col items-center gap-3 text-center">
              <p className="text-[13px] text-[#8a8a8a] leading-[1.5] max-w-[360px]">
                ¿Buscás staff para tu evento y todavía no tenés cuenta? Contanos
                qué necesitás y te contactamos.
              </p>
              <Link
                href="/#productores"
                className="font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.15em] text-[#e5e2e1] border-b border-[#4c4546] pb-1 hover:border-[#e5e2e1] transition-colors"
              >
                Dejar mi consulta
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
