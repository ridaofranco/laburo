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
    <div className="sticky bottom-0 z-20 -mx-md mt-lg border-t border-border bg-surface-0/95 backdrop-blur px-md pt-sm pb-[max(var(--spacing-sm),env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-sm">
        <a
          href={waLink(telefono, saludo)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-xs min-h-[48px] rounded-xl bg-accent box-glow text-fg text-label font-semibold px-md transition-transform active:scale-[0.98]"
        >
          <WhatsAppGlyph size={18} className="shrink-0" />
          Escribir por WhatsApp
        </a>
        <a
          href={telLink(telefono)}
          aria-label="Llamar al candidato"
          className="flex items-center justify-center gap-xs min-h-[48px] rounded-xl bg-surface-2 border border-border text-fg text-label font-semibold px-md transition-transform active:scale-[0.98]"
        >
          <Phone size={18} aria-hidden="true" className="shrink-0" />
          <span>Llamar</span>
        </a>
      </div>
    </div>
  );
}
