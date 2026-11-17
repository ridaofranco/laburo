"use client";

/**
 * Carga el rastreador de origen (`public/origen-casa.js`) solo en las páginas
 * públicas. Ver `lib/origen.ts`.
 *
 * Va en el layout raíz porque LABURO no tiene un layout solo para lo público.
 * Dos cuidados que salen de ahí:
 *  1. El archivo se pide únicamente cuando la ruta es pública.
 *  2. Pasar de la portada al portal no recarga la página, así que el rastreador
 *     sigue escuchando los clics. Fuera de lo público se lo pone en pausa: si no,
 *     cada WhatsApp que una productora le manda a un trabajador desde el portal
 *     quedaría anotado como una consulta.
 */

import { useEffect } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { esRutaPublica } from "@/lib/origen";

export function OrigenCasa() {
  const publica = esRutaPublica(usePathname() ?? "");

  useEffect(() => {
    window.derOrigenPausa = !publica;
  }, [publica]);

  return publica ? <Script src="/origen-casa.js" strategy="afterInteractive" /> : null;
}
