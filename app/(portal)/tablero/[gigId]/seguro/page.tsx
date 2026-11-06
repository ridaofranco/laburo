export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { datosSeguro } from "./actions";
import { SeguroClient } from "./seguro-client";

export const metadata: Metadata = { title: "LABURO. | Asegurar al equipo" };

export default async function SeguroPage({ params }: { params: Promise<{ gigId: string }> }) {
  const { gigId } = await params;
  const d = await datosSeguro(gigId);
  if (!d) redirect("/tablero");

  return (
    <div className="w-full max-w-[960px] mx-auto px-5 md:px-10 py-10 md:py-16 flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link
          href="/tablero"
          className="inline-flex items-center gap-2 label-tech text-[11px] uppercase tracking-widest text-[#988e90] hover:text-[#e5e2e1] transition-colors w-fit"
        >
          <ArrowLeft size={14} /> Volver al tablero
        </Link>
        <p className="label-tech text-[12px] uppercase tracking-[0.2em] text-[#c6c6c6]">Seguro de accidentes personales</p>
        <h1 className="t-display text-[#e5e2e1]">{d.gig.title || "Evento"}</h1>
        <p className="text-[15px] text-[#cfc4c5] leading-[1.6] max-w-[640px]">
          Asegurá a la gente que aceptó tu oferta, con cláusula de no repetición si el lugar la pide. El seguro lo emite
          MeCubro y le pagás directo a MeCubro por MercadoPago: LABURO no cobra nada.
        </p>
        {d.ambiente === "sandbox" ? (
          <p role="status" className="border border-[#f5a623]/40 bg-[#f5a623]/10 px-4 py-3 text-[13px] text-[#f5a623]">
            Modo prueba (sandbox de MeCubro): los seguros no son reales.
          </p>
        ) : null}
      </header>
      <SeguroClient
        gigId={gigId}
        personas={d.personas}
        seguros={d.seguros}
        coberturas={d.coberturas}
        errorCotizar={d.errorCotizar}
        vigencia={d.vigencia}
        activo={d.activo}
      />
    </div>
  );
}
