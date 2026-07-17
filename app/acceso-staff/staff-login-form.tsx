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

const up = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] as const, delay },
});

export function StaffLoginForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const callbackUrl = () => `${window.location.origin}/auth/callback`;

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
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl(),
        // El staff aún no tiene cuenta: se la creamos al pedir el link.
        shouldCreateUser: true,
      },
    });
    setLoading(false);
    if (error) {
      toast.error("No pudimos enviar el link. Probá de nuevo.");
    } else {
      setSent(true);
      toast.success("Revisá tu email para el link de acceso.");
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
          className="label-tech text-[12px] uppercase tracking-[0.3em] text-[#cfc4c5] mb-[64px] md:mb-[96px]"
        >
          Portal de Staff
        </motion.p>

        {sent ? (
          <motion.p {...up(0.1)} className="text-center text-[16px] leading-[1.6] text-[#cfc4c5]">
            Link enviado a <span className="text-[#e5e2e1]">{email}</span>. Revisá
            tu email para entrar a tu cuenta.
          </motion.p>
        ) : (
          <motion.form {...up(0.2)} onSubmit={handleMagicLink} className="w-full flex flex-col gap-12">
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
              <p className="mt-3 text-[13px] text-[#565656] leading-[1.5]">
                Usá el mismo email con el que te postulaste. Te mandamos un link
                para entrar, sin contraseña.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full border border-[#e5e2e1] bg-transparent text-[#e5e2e1] py-6 px-8 flex items-center justify-center gap-4 hover:bg-[#e5e2e1] hover:text-black transition-colors duration-150 cursor-pointer disabled:opacity-50"
            >
              <span className="font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.2em]">
                {loading ? "Enviando…" : "Entrar"}
              </span>
              <ArrowRight size={18} strokeWidth={1.5} />
            </button>

            <button
              type="button"
              onClick={handleGoogle}
              className="mx-auto font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.1em] text-[#988e90] hover:text-[#e5e2e1] transition-colors"
            >
              Entrar con Google
            </button>

            <a
              href="/login"
              className="mx-auto font-[family-name:var(--font-geist)] text-[11px] uppercase tracking-[0.1em] text-[#565656] hover:text-[#cfc4c5] transition-colors"
            >
              ¿Sos productor? Ingresá acá
            </a>
          </motion.form>
        )}
      </div>
    </main>
  );
}
