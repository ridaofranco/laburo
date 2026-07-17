"use client";

/**
 * Vista de "Oferta enviada" (client, animaciones Motion). Recibe el resumen REAL
 * por props desde el server (que lo lee de los query params ?staff/&rol/&evento).
 * Si no vino ningún dato, NO renderiza el bento (nada de nombres inventados):
 * muestra la confirmación genérica y honesta. Estilos exactos de Stitch.
 */

import Link from "next/link";
import { CheckCheck, ArrowLeft } from "lucide-react";
import { motion } from "motion/react";

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export interface ResumenCell {
  label: string;
  value: string;
}

export function ConfirmacionView({ resumen }: { resumen: ResumenCell[] }) {
  const tieneResumen = resumen.length > 0;

  return (
    <div className="max-w-[1440px] mx-auto w-full px-6 md:px-20 py-16 md:py-24">
      <div className="w-full flex flex-col items-center">
        <motion.div {...fadeUp} transition={{ duration: 0.8 }} className="mb-[48px]">
          <CheckCheck strokeWidth={1.5} className="w-16 h-16 md:w-20 md:h-20 text-[#c6c6c6]" />
        </motion.div>

        <motion.h1
          {...fadeUp}
          transition={{ duration: 1, delay: 0.1 }}
          className={`font-[family-name:var(--font-syne)] text-[40px] md:text-[120px] font-bold md:font-extrabold text-center uppercase text-[#e5e2e1] tracking-tighter leading-[1.1] ${
            tieneResumen ? "mb-[80px] md:mb-[160px]" : "mb-12"
          }`}
        >
          Oferta Enviada
        </motion.h1>

        {tieneResumen ? (
          <motion.div
            {...fadeUp}
            transition={{ duration: 1, delay: 0.2 }}
            className="w-full max-w-[896px] grid grid-cols-1 md:grid-cols-3 gap-[1px] bg-[#4c4546] p-[1px] mb-[80px] md:mb-[160px] mx-auto"
          >
            {resumen.map((cell) => (
              <div
                key={cell.label}
                className="bg-[#0e0e0e] p-[48px] flex flex-col gap-2 hover:bg-[#1c1b1b] transition-colors duration-300"
              >
                <span className="label-tech text-[12px] text-[#cfc4c5] uppercase tracking-widest">
                  {cell.label}
                </span>
                <span className="font-[family-name:var(--font-syne)] text-[32px] font-semibold text-[#e5e2e1] leading-[1.2] tracking-tight">
                  {cell.value}
                </span>
              </div>
            ))}
          </motion.div>
        ) : (
          <motion.p
            {...fadeUp}
            transition={{ duration: 1, delay: 0.2 }}
            className="text-[18px] text-[#cfc4c5] text-center max-w-[520px] mb-[80px] md:mb-[120px] leading-[1.6]"
          >
            Le llegó la propuesta con el link para confirmar. Podés seguir el
            estado desde el perfil o desde el tablero de eventos.
          </motion.p>
        )}

        <motion.div
          {...fadeUp}
          transition={{ duration: 1, delay: 0.3 }}
          className="w-full flex justify-center"
        >
          <Link
            href="/buscar"
            className="group relative inline-flex items-center justify-center bg-[#c6c6c6] text-[#303030] px-12 py-6 border border-transparent hover:bg-transparent hover:text-[#c6c6c6] hover:border-[#c6c6c6] transition-all duration-150"
          >
            <ArrowLeft
              size={20}
              className="absolute left-6 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300"
            />
            <span className="label-tech text-[12px] uppercase tracking-widest group-hover:translate-x-4 transition-transform duration-300">
              Volver al roster
            </span>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
