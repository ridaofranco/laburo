/**
 * Botón de WhatsApp de la puerta del proveedor.
 *
 * Es una copia deliberada del de app/o/[token]/wa-cta.tsx, no un import cruzado:
 * esa ruta es la de las ofertas del staff y no tiene por qué ser una dependencia
 * de esta. Acá además no va el link al portal de staff (el proveedor no tiene
 * portal todavía), así que el componente no es el mismo.
 *
 * Módulo SIN directiva: lo usan el server component (page.tsx) y también los
 * client components. Es sólo markup (un <a>), funciona en los dos mundos.
 * Glifo OFICIAL de WhatsApp (regla dura de marca) y verde #25D366, igual que en
 * los mails y en la web.
 */

import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import { waLink } from "@/lib/wa";

/** El WhatsApp de SOMOS DER, el mismo de la web, los mails y /o/[token]. */
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
