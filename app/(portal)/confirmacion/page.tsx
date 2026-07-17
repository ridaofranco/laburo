/**
 * Confirmación de envío de oferta (lado PRODUCTOR). Porteo FIEL de la pantalla
 * Stitch "Confirmación Envío - Minimalista Radical" / "Oferta Enviada - Success":
 * ícono done_all, heading monumental, grilla bento de hairlines con el resumen
 * (staff / rol / evento) y CTA "Volver al roster". Datos de ejemplo estáticos.
 * Copy en español rioplatense (voseo), sin guión largo. Estilos EXACTOS de Stitch
 * en valores arbitrarios (cells #0e0e0e, hairline #4c4546, primary #c6c6c6).
 * Vive dentro del portal: el layout ya pone sidebar + <main md:pl-[280px]>, así que
 * devolvemos solo el contenido centrado. Animaciones de entrada con Motion.
 */

"use client";

import Link from "next/link";
import { CheckCheck, ArrowLeft } from "lucide-react";
import { motion } from "motion/react";

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

// Resumen de la oferta enviada (ejemplo estático).
const resumen = [
  { label: "Staff", value: "Elena Rostova" },
  { label: "Rol", value: "Curadora Principal" },
  { label: "Evento", value: "Art Basel '24" },
];

export default function ConfirmacionPage() {
  return (
    <div className="max-w-[1440px] mx-auto w-full px-6 md:px-20 py-16 md:py-24">
      <div className="w-full flex flex-col items-center">
        {/* Ícono de estado */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.8 }}
          className="mb-[48px]"
        >
          <CheckCheck
            strokeWidth={1.5}
            className="w-16 h-16 md:w-20 md:h-20 text-[#c6c6c6]"
          />
        </motion.div>

        {/* Heading monumental */}
        <motion.h1
          {...fadeUp}
          transition={{ duration: 1, delay: 0.1 }}
          className="font-[family-name:var(--font-syne)] text-[40px] md:text-[120px] font-bold md:font-extrabold text-center uppercase text-[#e5e2e1] tracking-tighter leading-[1.1] mb-[80px] md:mb-[160px]"
        >
          Oferta Enviada
        </motion.h1>

        {/* Resumen bento (grilla de hairlines) */}
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

        {/* Acción principal */}
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
