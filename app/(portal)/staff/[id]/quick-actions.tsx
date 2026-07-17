"use client";

/**
 * Barra de acciones rápidas del perfil (Claude's Discretion, locked).
 * Sticky abajo, 44px+, respeta safe-area. Primario "Escribir por WhatsApp"
 * (wa.me), secundario "Llamar" (tel:) con aria-label siempre "Llamar al
 * candidato". La oferta formal llega en Fase 3.
 */

import { Phone } from "lucide-react";
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import { waLink, telLink } from "@/lib/wa";

export function QuickActions({
  telefono,
  nombre,
}: {
  telefono: string;
  nombre?: string | null;
}) {
  const primerNombre = (nombre ?? "").trim().split(/\s+/)[0] ?? "";
  const saludo = primerNombre
    ? `Hola ${primerNombre}, te contacto de SOMOS DER por un laburo en un evento.`
    : "Hola, te contacto de SOMOS DER por un laburo en un evento.";

  return (
    // Full-bleed dentro del contenedor del perfil: -mx-6/-mx-20 compensa el
    // padding px-6 md:px-20 del wrapper, y el padding interno lo vuelve a alinear
    // con el contenido. Tokens Stitch (negro, hairline #1A1A1A, radio 0).
    <div className="sticky bottom-0 z-20 -mx-6 md:-mx-20 mt-12 border-t border-[#1A1A1A] bg-black/95 backdrop-blur px-6 md:px-20 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-3">
        <a
          href={waLink(telefono, saludo)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-2 min-h-[48px] bg-[#e5e2e1] text-black border border-[#e5e2e1] label-tech text-[13px] px-6 transition-colors hover:bg-transparent hover:text-[#e5e2e1]"
        >
          <WhatsAppGlyph size={18} className="shrink-0" />
          Escribir por WhatsApp
        </a>
        <a
          href={telLink(telefono)}
          aria-label="Llamar al candidato"
          className="flex items-center justify-center gap-2 min-h-[48px] bg-transparent border border-[#4c4546] text-[#e5e2e1] label-tech text-[12px] px-6 transition-colors hover:border-[#e5e2e1] active:scale-[0.98]"
        >
          <Phone size={18} aria-hidden="true" className="shrink-0" />
          <span>Llamar</span>
        </a>
      </div>
    </div>
  );
}
