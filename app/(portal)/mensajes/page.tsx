/**
 * Mensajes (v2, placeholder HONESTO). El mockup de Stitch traía un chat con
 * conversaciones inventadas ("Festival Sur • Live", hilos falsos). En v1 no hay
 * mensajería in-app: la coordinación con el staff es por WhatsApp (wa.me desde el
 * perfil y la oferta). En vez de simular un chat que no funciona, se declara
 * honesto que llega más adelante. Mantiene el shell Stitch.
 */

import Link from "next/link";
import { MessagesSquare } from "lucide-react";

export default function MensajesPage() {
  return (
    <div className="max-w-[1440px] mx-auto w-full px-6 md:px-20 py-16 md:py-24">
      <header className="mb-16 border-b border-[#4c4546] pb-8">
        <p className="label-tech text-[12px] text-[#cfc4c5] mb-4 tracking-[0.2em]">
          Próximamente
        </p>
        <h1 className="font-[family-name:var(--font-syne)] text-[clamp(2.2rem,9vw,96px)] font-extrabold leading-[1.05] tracking-[-0.04em] uppercase text-[#e5e2e1] break-words">
          Mensajes
        </h1>
      </header>

      <div className="max-w-[560px]">
        <div className="w-16 h-16 border border-[#4c4546] grid place-items-center mb-8">
          <MessagesSquare size={28} className="text-[#cfc4c5]" />
        </div>
        <p className="text-[18px] leading-[1.7] text-[#cfc4c5]">
          El chat dentro de LABURO llega en una próxima versión. Por ahora la
          coordinación con el staff es por WhatsApp: desde el perfil de cada
          persona y desde la oferta tenés el botón para escribirle directo.
        </p>
        <Link
          href="/buscar"
          className="mt-8 inline-block label-tech text-[12px] text-[#e5e2e1] hover:opacity-70 border-b border-[#4c4546] pb-1"
        >
          Volver a buscar staff
        </Link>
      </div>
    </div>
  );
}
