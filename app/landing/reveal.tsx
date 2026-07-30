"use client";

/**
 * Aparicion suave al entrar en viewport (Motion, la libreria de la casa).
 * Un solo patron para toda la landing: fade + subida corta, una vez sola.
 * Se respeta prefers-reduced-motion via el prop de Motion en el transition.
 */

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export function Reveal({
  children,
  delay = 0,
  className,
  visibleDeArranque = false,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  /**
   * NO se oculta al montar: el bloque se sirve ya visible.
   *
   * POR QUE EXISTE (diagnostico de conversion 2026-07-30, L7): con
   * `initial={{opacity:0}}`, Motion escribe ese opacity:0 INLINE en el HTML del
   * servidor, y solo `whileInView` lo levanta. Sin JS, o con el JS todavia
   * cargando, la landing se ve NEGRA: verificado con Playwright sin JS, solo
   * quedaba el header y 17 bloques con opacity:0 en el HTML servido.
   *
   * Con esto en true, Motion no escribe estilos iniciales, asi que el HTML
   * servido ya trae el bloque visible. Se usa en el hero (lo primero que ve
   * cualquiera, y donde viven los dos CTA); el resto de la pagina sigue
   * animado, porque ahi hace falta scrollear y para eso ya hubo JS.
   */
  visibleDeArranque?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce || visibleDeArranque ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
