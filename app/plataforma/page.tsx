/**
 * /plataforma — SOMOS DER por encima de todas las productoras (Fase 0).
 *
 * El gate real está en la base: las RPC de la 0054 chequean
 * `is_platform_admin()` adentro. Si el que entra no es de la plataforma, todas
 * devuelven vacío y acá se muestra el cartel de "no sos administrador". No se
 * decide ningún permiso en esta capa.
 */

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { LaburoWordmark } from "@/components/laburo-wordmark";
import {
  getResumen,
  getBusquedas,
  getContrataciones,
  getOrganizaciones,
} from "./actions";
import { PlataformaClient } from "./plataforma-client";

export const metadata: Metadata = {
  title: "LABURO. | Plataforma",
  robots: { index: false, follow: false },
};

export default async function PlataformaPage() {
  const resumen = await getResumen();

  if (!resumen.ok) {
    return (
      <main className="min-h-dvh bg-black text-[#e5e2e1] flex flex-col items-center justify-center px-6 gap-6">
        <LaburoWordmark className="h-[48px] w-auto" />
        <p className="text-[16px] text-[#cfc4c5] text-center max-w-[420px] leading-[1.6]">
          Esta pantalla es solo para el equipo de SOMOS DER como plataforma. Tu
          cuenta no tiene ese permiso.
        </p>
        <a
          href="/dashboard"
          className="label-tech text-[12px] uppercase tracking-widest text-[#cfc4c5] hover:text-[#e5e2e1] border-b border-[#4c4546] hover:border-[#e5e2e1] pb-1 transition-colors"
        >
          Ir a mi panel
        </a>
      </main>
    );
  }

  const [busquedas, contrataciones, organizaciones] = await Promise.all([
    getBusquedas(),
    getContrataciones(),
    getOrganizaciones(),
  ]);

  return (
    <main className="min-h-dvh bg-[#131313] text-[#e5e2e1] antialiased">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-10 md:py-16 flex flex-col gap-12">
        {/* items-start: sin esto el stretch de la columna flex estira el
         * wordmark a todo el ancho del contenedor. Mismo bug que el footer. */}
        <header className="flex flex-col items-start gap-3">
          <LaburoWordmark className="h-[28px] w-auto" />
          <p className="label-tech text-[12px] uppercase tracking-[0.2em] text-[#c6c6c6] mt-4">
            Plataforma
          </p>
          <h1 className="t-display text-[#e5e2e1]">Todo lo que pasa en LABURO</h1>
          <p className="text-[16px] text-[#cfc4c5] leading-[1.6] max-w-[640px] mt-1">
            Nadie necesita tu permiso para publicar, esa fue la decisión. Esta
            pantalla es la contracara: acá ves todo lo que se publicó y podés
            bajar lo que esté mal.
          </p>
        </header>

        <PlataformaClient
          resumen={resumen}
          busquedas={busquedas}
          contrataciones={contrataciones}
          organizaciones={organizaciones}
        />
      </div>
    </main>
  );
}
