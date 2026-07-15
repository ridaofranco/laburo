"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const callbackUrl = () => `${window.location.origin}/auth/callback`;

  const handleGoogleLogin = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl(),
      },
    });
    if (error) {
      toast.error("No pudimos iniciar sesión. Probá de nuevo.");
    }
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
      },
    });
    setLoading(false);
    if (error) {
      toast.error("No pudimos enviar el link. Probá de nuevo.");
    } else {
      setMagicLinkSent(true);
      toast.success("Revisá tu email para el link de acceso.");
    }
  };

  return (
    <main className="min-h-dvh flex items-center justify-center px-md pb-[env(safe-area-inset-bottom)]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[360px] flex flex-col items-center text-center"
      >
        {/* Lockup de marca: única pieza con Baloo 2 + glow en esta pantalla */}
        <h1 className="font-lockup text-glow text-[40px] mb-lg select-none">
          LABURO
        </h1>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full min-h-[44px] rounded-xl bg-accent box-glow text-fg text-label font-semibold px-md py-sm transition-transform active:scale-[0.98]"
        >
          Entrar con Google
        </button>

        <div className="w-full flex items-center gap-md my-lg">
          <div className="flex-1 border-t border-border" />
          <span className="text-label text-fg-subtle font-normal">o</span>
          <div className="flex-1 border-t border-border" />
        </div>

        {magicLinkSent ? (
          <p className="text-body text-fg-muted">
            Link enviado a <span className="text-fg">{email}</span>. Revisá tu
            email.
          </p>
        ) : (
          <form onSubmit={handleMagicLink} className="w-full flex flex-col gap-sm">
            <input
              type="email"
              placeholder="Tu email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full min-h-[44px] rounded-xl bg-surface-2 border border-border text-fg text-body placeholder:text-fg-muted px-md py-sm outline-none focus:ring-[3px] focus:ring-accent/45"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] rounded-xl bg-surface-2 border border-border text-fg text-label font-semibold px-md py-sm transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? "Enviando…" : "Mandame un link"}
            </button>
          </form>
        )}
      </motion.div>
    </main>
  );
}
