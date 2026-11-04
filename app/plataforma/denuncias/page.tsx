/**
 * /plataforma/denuncias — las denuncias pendientes de revisión (0105, 4/11).
 *
 * Cada denuncia llega igual por Telegram y mail; esto es el registro para
 * revisarlas con calma y dar de baja la oferta en un clic. El gate real está en
 * la base (`is_platform_admin()` adentro de las RPC). Acá no se decide permiso.
 */

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { LaburoWordmark } from "@/components/laburo-wordmark";
import { getResumen, getDenuncias } from "../actions";
import { cortePorContexto } from "../gate";
import { DenunciasClient } from "./denuncias-client";

export const metadata: Metadata = {
  title: "LABURO. | Plataforma · Denuncias",
  robots: { index: false, follow: false },
};

export default async function PlataformaDenunciasPage() {
  const fueraDeContexto = await cortePorContexto();
  if (fueraDeContexto) return fueraDeContexto;

  const resumen = await getResumen();
  if (!resumen.ok) {
    return (
      <main className="min-h-dvh bg-black text-[#e5e2e1] flex flex-col items-center justify-center px-6 gap-6">
        <LaburoWordmark className="h-[48px] w-auto" />
        <p className="text-[16px] text-[#cfc4c5] text-center max-w-[420px] leading-[1.6]">
          Esta pantalla es solo para el equipo de SOMOS DER como plataforma. Tu
          cuenta no tiene ese permiso.
        </p>
        <Link
          href="/dashboard"
          className="label-tech text-[12px] uppercase tracking-widest text-[#cfc4c5] hover:text-[#e5e2e1] border-b border-[#4c4546] hover:border-[#e5e2e1] pb-1 transition-colors"
        >
          Ir a mi panel
        </Link>
      </main>
    );
  }

  const { sinTabla, denuncias } = await getDenuncias();

  return (
    <main className="min-h-dvh bg-[#131313] text-[#e5e2e1] antialiased">
      <div className="w-full max-w-[1200px] mx-auto px-6 md:px-10 py-10 md:py-16 flex flex-col gap-12">
        <header className="flex flex-col items-start gap-3">
          <LaburoWordmark className="h-[28px] w-auto" />
          <p className="label-tech text-[12px] uppercase tracking-[0.2em] text-[#c6c6c6] mt-4">
            Plataforma // Denuncias
          </p>
          <h1 className="t-display text-[#e5e2e1] break-words">Denuncias por revisar</h1>
          <p className="text-[16px] text-[#cfc4c5] leading-[1.6] max-w-[640px] mt-1">
            Las urgentes (piden plata, discriminan, trabajo ilegal) van primero.
            «Dar de baja» saca la búsqueda de la lista o vence la oferta por link;
            nada se borra y una búsqueda bajada se puede restituir desde plataforma.
          </p>
          <Link
            href="/plataforma"
            className="label-tech text-[11px] tracking-[0.2em] text-[#8a8a8a] hover:text-[#e5e2e1] transition-colors mt-2"
          >
            Volver a plataforma
          </Link>
        </header>

        {sinTabla ? (
          <p className="text-[15px] text-[#cfc4c5] leading-[1.6] max-w-[640px] border border-[#4c4546] p-5">
            La tabla de denuncias todavía no está creada en la base (migración 0105).
            Mientras tanto, cada denuncia te sigue llegando por Telegram y por mail.
          </p>
        ) : (
          <DenunciasClient denuncias={denuncias} />
        )}
      </div>
    </main>
  );
}
