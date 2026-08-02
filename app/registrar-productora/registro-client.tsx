"use client";

/**
 * El alta de la productora: dos campos y listo.
 *
 * Dos campos porque es todo lo que hace falta para que exista la cuenta. El
 * resto (teléfono, CUIT, dirección) se pide cuando sirva para algo, no en la
 * puerta. Cada campo de más en un formulario de alta es gente que no se anota.
 */

import { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { LaburoWordmark } from "@/components/laburo-wordmark";
import { registrarProductora } from "./actions";

const up = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] as const, delay },
});

const input =
  "w-full bg-transparent border-0 border-b border-[#4c4546] focus:border-[#e5e2e1] outline-none text-[18px] leading-[1.6] text-[#e5e2e1] py-4 px-0 rounded-none transition-colors duration-300";
const label =
  "block mb-2 font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.1em] text-[#cfc4c5]";

export function RegistroProductoraClient() {
  const [productora, setProductora] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const r = await registrarProductora({ productora, email });
      if (r.ok) setListo(true);
      else setError(r.error ?? "No se pudo. Probá de nuevo.");
    } catch {
      setError("No se pudo. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-dvh flex flex-col items-center justify-center bg-black text-[#e5e2e1] px-6">
      <div className="relative z-10 w-full max-w-[448px] flex flex-col items-center">
        <motion.div {...up(0)} className="mb-4">
          <LaburoWordmark className="h-[56px] md:h-[72px] w-auto" priority />
        </motion.div>
        <motion.p
          {...up(0.05)}
          className="label-tech text-[12px] uppercase tracking-[0.3em] text-[#cfc4c5] mb-10"
        >
          Para productoras
        </motion.p>

        {listo ? (
          <motion.div {...up(0.1)} className="w-full flex flex-col items-center gap-6">
            <p className="text-center text-[16px] leading-[1.6] text-[#cfc4c5]">
              Listo. Le mandamos a{" "}
              <span className="text-[#e5e2e1]">{email}</span> un mail para que
              elijas tu contraseña. Revisá tu casilla, y si no lo ves, mirá en
              spam.
            </p>
            <a
              href="/login"
              className="label-tech text-[12px] uppercase tracking-widest text-[#cfc4c5] hover:text-[#e5e2e1] border-b border-[#4c4546] hover:border-[#e5e2e1] pb-1 transition-colors"
            >
              Ya la definí, quiero entrar
            </a>
          </motion.div>
        ) : (
          <motion.form {...up(0.15)} onSubmit={onSubmit} className="w-full flex flex-col gap-10">
            <p className="text-[16px] text-[#cfc4c5] leading-[1.6] -mt-2">
              Cargá tus eventos, publicá qué personal necesitás y recibí a la
              gente que quiere trabajar. Publicar es gratis.
            </p>

            <div>
              <label className={label} htmlFor="productora">
                Nombre de tu productora *
              </label>
              <input
                id="productora"
                className={input}
                value={productora}
                onChange={(e) => setProductora(e.target.value)}
                required
                autoComplete="organization"
                placeholder=" "
              />
            </div>

            <div>
              <label className={label} htmlFor="email">
                Tu email *
              </label>
              <input
                id="email"
                type="email"
                className={input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder=" "
              />
              <p className="mt-3 text-[13px] text-[#8a8a8a] leading-[1.5]">
                Con este mail vas a entrar. Te mandamos un link para que elijas
                tu contraseña.
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
              className="w-full border border-[#e5e2e1] bg-[#e5e2e1] text-black py-6 px-8 flex items-center justify-center gap-4 hover:bg-transparent hover:text-[#e5e2e1] transition-colors duration-150 cursor-pointer disabled:opacity-50"
            >
              <span className="font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.2em]">
                {loading ? "Un segundo…" : "Crear mi cuenta"}
              </span>
              <ArrowRight size={18} strokeWidth={1.5} />
            </button>

            <div className="w-full border-t border-[#4c4546]/60 pt-8 flex flex-col items-center gap-3">
              <a
                href="/login"
                className="font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.1em] text-[#988e90] hover:text-[#e5e2e1] transition-colors"
              >
                ¿Ya tenés cuenta? Entrá acá
              </a>
              <a
                href="/acceso-staff"
                className="font-[family-name:var(--font-geist)] text-[11px] uppercase tracking-[0.1em] text-[#6f6f6f] hover:text-[#cfc4c5] transition-colors"
              >
                ¿Trabajás en eventos? Entrá como staff
              </a>
            </div>
          </motion.form>
        )}
      </div>
    </main>
  );
}
