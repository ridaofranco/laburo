/**
 * /sumate, registro nativo de staff en la plataforma (arista "registro para
 * trabajar"). Público (middleware). Mismo pool que somosder.ar. Abre en el
 * camino corto (alcanza con el CV); el formulario largo queda a un click.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { SumateClient } from "./sumate-client";
import { LaburoWordmark } from "@/components/laburo-wordmark";

const DESCRIPCION =
  "Trabajo en eventos: promotoras, bartenders, mozos, seguridad, técnicos y más. Subí tu CV en un minuto y las productoras te llaman cuando arman un evento. Es gratis.";

export const metadata: Metadata = {
  title: "Trabajo en eventos: sumate con tu CV | LABURO",
  description: DESCRIPCION,
  alternates: { canonical: "/sumate" },
  openGraph: {
    type: "website",
    url: "/sumate",
    siteName: "LABURO",
    locale: "es_AR",
    title: "Trabajo en eventos: sumate con tu CV | LABURO",
    description: DESCRIPCION,
    images: [{ url: "/brand/laburo-og.png", width: 1200, height: 630, alt: "LABURO" }],
  },
};

export default function SumatePage() {
  return (
    <div className="min-h-dvh bg-[#131313] text-[#e5e2e1]">
      <header className="px-6 md:px-20 py-6 border-b border-[#1A1A1A]">
        <Link href="/">
          <LaburoWordmark className="h-[22px] w-auto" />
        </Link>
      </header>
      <SumateClient />
    </div>
  );
}
