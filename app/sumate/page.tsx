/**
 * /sumate — registro nativo de staff en la plataforma (arista "registro para
 * trabajar"). Público (middleware). Mismo formulario y mismo pool que somosder.ar.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { RegistroForm } from "./registro-form";

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
      <RegistroForm />
    </div>
  );
}
