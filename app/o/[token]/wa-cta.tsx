/**
 * CTA de WhatsApp + link al portal para la ruta pública de la oferta (fix UX 28/7).
 *
 * Antes las pantallas de resultado decían "escribinos por WhatsApp" en el texto
 * pero no tenían ningún link real: página muerta. Ahora cada pantalla tiene UNA
 * acción principal por UN canal: este botón wa.me con mensaje precargado según
 * el caso, para que del otro lado se sepa de qué se habla sin preguntar.
 *
 * Módulo SIN directiva: lo consumen el RSC (page.tsx) y el client component
 * (accept-decline.tsx). Es sólo markup (un <a>), funciona en ambos mundos.
 * Glifo OFICIAL de WhatsApp (regla dura de marca), verde #25D366 como en los
 * mails (pie-whatsapp).
 */

import Link from "next/link";
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import { waLink } from "@/lib/wa";

/** El WhatsApp de SOMOS DER, el mismo de la web y del pie de los mails. */
const WA_NUMERO = "5491171540675";

export function WhatsAppCta({
  label,
  mensaje,
}: {
  label: string;
  mensaje: string;
}) {
  return (
    <a
      href={waLink(WA_NUMERO, mensaje)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-xs min-h-[48px] rounded-none bg-[#25D366] text-white border border-[#25D366] label-tech text-[13px] px-md transition-colors hover:bg-transparent hover:text-[#25D366]"
    >
      <WhatsAppGlyph size={18} className="shrink-0" />
      {label}
    </a>
  );
}

/**
 * Camino natural post-aceptación: el portal de staff existe (/acceso-staff
 * rutea por email de perfil a /panel-staff), así que a quien confirmó se le
 * ofrece seguir sus laburos ahí. Link secundario, discreto, no compite con el
 * CTA principal.
 */
export function PortalStaffLink() {
  return (
    <Link
      href="/acceso-staff"
      className="flex items-center justify-center min-h-[44px] text-label text-fg-muted underline underline-offset-4 transition-colors hover:text-fg"
    >
      Seguí tus laburos en el portal de staff
    </Link>
  );
}
