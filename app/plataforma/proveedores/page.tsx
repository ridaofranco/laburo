/**
 * /plataforma/proveedores — el control de la alta abierta.
 *
 * Existe por la 0060: desde el 5/8 cualquiera se anota como proveedor y aparece
 * en la vidriera al toque, sin aprobación previa. Esa decisión (Franco, 3/8) es
 * la correcta, pero deja el control para después, y "después" no existía:
 * staff_app_plataforma_moderar solo modera búsquedas de staff.
 *
 * El gate real está en la base (`is_platform_admin()` adentro de la RPC). Acá no
 * se decide ningún permiso.
 */

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { LaburoWordmark } from "@/components/laburo-wordmark";
import { getResumen, getProveedores } from "../actions";
import { ProveedoresClient } from "./proveedores-client";
import { cortePorContexto } from "../gate";

export const metadata: Metadata = {
  title: "LABURO. | Plataforma · Proveedores",
  robots: { index: false, follow: false },
};

export default async function PlataformaProveedoresPage() {
  // Mismo corte de contexto que /plataforma: operando otra productora, esta
  // pantalla no corresponde aunque el permiso siga estando.
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

  const proveedores = await getProveedores();

  return (
    <main className="min-h-dvh bg-[#131313] text-[#e5e2e1] antialiased">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-10 md:py-16 flex flex-col gap-12">
        <header className="flex flex-col items-start gap-3">
          <LaburoWordmark className="h-[28px] w-auto" />
          <p className="label-tech text-[12px] uppercase tracking-[0.2em] text-[#c6c6c6] mt-4">
            Plataforma // Proveedores
          </p>
          <h1 className="t-display text-[#e5e2e1]">Quién se publicó en el directorio</h1>
          <p className="text-[16px] text-[#cfc4c5] leading-[1.6] max-w-[640px] mt-1">
            Los proveedores se anotan solos y aparecen en la vidriera sin que
            nadie apruebe nada. Acá los ves a todos, con su bio completa, y bajás
            en un clic al que esté mal.
          </p>
          <Link
            href="/plataforma"
            className="label-tech text-[11px] tracking-[0.2em] text-[#8a8a8a] hover:text-[#e5e2e1] transition-colors mt-2"
          >
            Volver a plataforma
          </Link>
        </header>

        <ProveedoresClient proveedores={proveedores} />
      </div>
    </main>
  );
}
