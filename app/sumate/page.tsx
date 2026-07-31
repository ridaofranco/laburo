/**
 * /sumate, registro nativo de staff en la plataforma (arista "registro para
 * trabajar"). Público (middleware). Mismo pool que somosder.ar. Abre en el
 * camino corto (alcanza con el CV); el formulario largo queda a un click.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { SumateClient } from "./sumate-client";

export const metadata: Metadata = {
  title: "LABURO. | Sumate al pool",
};

export default function SumatePage() {
  return (
    <div className="min-h-dvh bg-[#131313] text-[#e5e2e1]">
      <header className="px-6 md:px-20 py-6 border-b border-[#1A1A1A]">
        <Link href="/" className="font-[family-name:var(--font-syne)] text-[24px] font-extrabold tracking-tighter uppercase text-[#e5e2e1]">
          LABURO.
        </Link>
      </header>
      <SumateClient />
    </div>
  );
}
