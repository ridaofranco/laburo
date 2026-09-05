"use client";

/**
 * "¿Problemas? Escribinos" — el canal de soporte, en la barra lateral del
 * portal, abajo de todo con Ajustes y Logout.
 *
 * Va ahí y no en un botón flotante porque un flotante tapa contenido en el
 * teléfono, y porque el lugar donde alguien busca ayuda es el mismo donde busca
 * su configuración: abajo, en la zona de "cosas de mi cuenta".
 *
 * Dos canales, y el orden importa: WhatsApp primero porque el que abre el
 * portal es la productora, que casi siempre está operando un evento y necesita
 * respuesta ahora.
 */

import { usePathname } from "next/navigation";
import { LifeBuoy } from "lucide-react";
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import {
  SOPORTE_WHATSAPP,
  SOPORTE_EMAIL,
  soporteWhatsappMensaje,
  soporteMailAsunto,
} from "@/lib/soporte";

export function SoporteLink() {
  // Mandar la pantalla desde donde escribe ahorra la primera repregunta.
  const pathname = usePathname();
  const desde = pathname && pathname !== "/" ? pathname : undefined;

  const wa = `https://wa.me/${SOPORTE_WHATSAPP}?text=${encodeURIComponent(
    soporteWhatsappMensaje(desde),
  )}`;
  const mail = `mailto:${SOPORTE_EMAIL}?subject=${encodeURIComponent(
    soporteMailAsunto(desde),
  )}`;

  return (
    <li className="pt-2">
      <span className="flex items-center gap-4 py-2 text-[#8a8a8a]">
        <LifeBuoy size={18} className="shrink-0" />
        <span className="label-tech text-[12px]">¿Problemas?</span>
      </span>
      <div className="flex flex-col gap-1 pl-[34px]">
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="label-tech text-[11px] text-[#cfc4c5] hover:text-[#25D366] transition-colors flex items-center gap-2 min-h-[32px]"
        >
          <WhatsAppGlyph size={13} className="shrink-0" />
          Escribinos
        </a>
        <a
          href={mail}
          className="label-tech text-[11px] text-[#cfc4c5] hover:text-[#e5e2e1] transition-colors min-h-[32px] flex items-center"
        >
          {SOPORTE_EMAIL}
        </a>
      </div>
    </li>
  );
}
