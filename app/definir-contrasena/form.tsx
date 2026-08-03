"use client";

/**
 * Pantalla para definir la contraseña. Misma estética que /acceso-staff, porque
 * es el paso siguiente del mismo recorrido y cambiar de look en el medio hace
 * dudar de si seguís en el sitio correcto (que es justo el problema que teníamos
 * con el mail de Supabase).
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { guardarContrasena } from "./actions";
import { LaburoWordmark } from "@/components/laburo-wordmark";

const up = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] as const, delay },
});

export function DefinirContrasenaForm() {
  const [password, setPassword] = useState("");
  const [repetida, setRepetida] = useState("");
  const [ver, setVer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await guardarContrasena(password, repetida);
      if (!r.ok) {
        setError(r.error ?? "No pudimos guardar la contraseña.");
        return;
      }
      setListo(true);
      // Ya quedó con sesión iniciada, así que no se le pide entrar de nuevo con
      // la contraseña recién creada: sería escribirla dos veces sin motivo.
      //
      // ⚠️ VA A /auth/callback Y NO A UN PANEL (arreglado el 3/8). Acá decía
      // "/panel-staff" escrito a mano, y esta pantalla la comparten el staff
      // (/sumate) y la PRODUCTORA (/registrar-productora): la productora
      // terminaba en el panel de los empleados y, peor, se salteaba el único
      // lugar donde corre `staff_app_provision_member`, así que nunca se volvía
      // dueña de su propia productora. Se registraba, elegía la clave, y la app
      // le decía "esta cuenta no tiene acceso".
      //
      // /auth/callback es el que sabe quién es cada uno: productora → su panel,
      // staff → el suyo. Toda pantalla compartida por dos actores tiene que
      // salir por ahí, nunca adivinar.
      setTimeout(() => { window.location.href = "/auth/callback?from=clave"; }, 1200);
    } catch {
      setError("No pudimos guardar la contraseña. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full bg-transparent border-0 border-b border-[#4c4546] focus:border-[#e5e2e1] outline-none text-[18px] leading-[1.6] text-[#e5e2e1] py-4 px-0 rounded-none transition-colors duration-300";
  const labelCls =
    "block mb-2 font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.1em] text-[#cfc4c5] transition-colors group-focus-within:text-[#e5e2e1]";

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
          className="label-tech text-[12px] uppercase tracking-[0.3em] text-[#cfc4c5] mb-[64px] md:mb-[96px]"
        >
          Tu contraseña
        </motion.p>

        {listo ? (
          <motion.p {...up(0.1)} className="text-center text-[16px] leading-[1.6] text-[#cfc4c5]">
            Listo. Te estamos llevando a tu perfil…
          </motion.p>
        ) : (
          <motion.form {...up(0.2)} onSubmit={onSubmit} className="w-full flex flex-col gap-10">
            <div className="relative w-full group">
              <label htmlFor="password" className={labelCls}>Elegí tu contraseña</label>
              <input
                id="password"
                name="password"
                type={ver ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
              />
              <p className="mt-3 text-[13px] text-[#8a8a8a] leading-[1.5]">
                Al menos 8 caracteres. Con esta contraseña vas a entrar de acá en
                adelante.
              </p>
            </div>

            <div className="relative w-full group">
              <label htmlFor="repetida" className={labelCls}>Repetila</label>
              <input
                id="repetida"
                name="repetida"
                type={ver ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                value={repetida}
                onChange={(e) => setRepetida(e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Poder ver lo que se escribe baja muchísimo los errores de tipeo,
                sobre todo desde el celular, que es como entra casi todo el staff. */}
            <button
              type="button"
              onClick={() => setVer((v) => !v)}
              className="self-start font-[family-name:var(--font-geist)] text-[11px] uppercase tracking-[0.1em] text-[#988e90] hover:text-[#e5e2e1] transition-colors"
            >
              {ver ? "Ocultar contraseña" : "Ver contraseña"}
            </button>

            {error ? (
              <p role="alert" className="text-[14px] leading-[1.5] text-[#ff8a8a]">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full border border-[#e5e2e1] bg-transparent text-[#e5e2e1] py-6 px-8 flex items-center justify-center gap-4 hover:bg-[#e5e2e1] hover:text-black transition-colors duration-150 cursor-pointer disabled:opacity-50"
            >
              <span className="font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.2em]">
                {loading ? "Guardando…" : "Guardar y entrar"}
              </span>
              <ArrowRight size={18} strokeWidth={1.5} />
            </button>
          </motion.form>
        )}
      </div>
    </main>
  );
}
