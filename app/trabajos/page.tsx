/**
 * TRABAJOS DISPONIBLES — el marketplace del lado de la persona (0052).
 *
 * Es la pantalla que le faltaba a LABURO: hasta hoy el staff solo podía esperar
 * a que le llegara una oferta. Acá ve lo que hay abierto y levanta la mano.
 *
 * Mismo gate que el resto del portal de staff (requireStaff → perfil por email
 * verificado) y mismo chrome (StaffNav).
 */

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { StaffNav } from "@/components/staff-nav";
import { requireStaff } from "@/lib/staff";
import { getTrabajosAbiertos } from "./actions";
import { TrabajosClient } from "./trabajos-client";

export const metadata: Metadata = {
  title: "LABURO. | Trabajos disponibles",
};

export default async function TrabajosPage() {
  await requireStaff();
  const trabajos = await getTrabajosAbiertos();

  return (
    <div className="min-h-dvh bg-[#131313] text-[#e5e2e1] antialiased flex flex-col md:flex-row">
      <StaffNav />

      <main className="flex-1 w-full md:pl-[280px] pt-16 md:pt-0 pb-[100px] md:pb-0">
        <div className="max-w-[1440px] mx-auto px-6 md:px-20 py-12 md:py-32 flex flex-col gap-10">
          <header className="flex flex-col gap-3">
            <p className="label-tech text-[12px] uppercase tracking-[0.2em] text-[#c6c6c6]">
              Trabajos disponibles
            </p>
            <h2 className="t-display text-[#e5e2e1]">
              {trabajos.length === 0
                ? "Sin búsquedas abiertas"
                : trabajos.length === 1
                  ? "Hay 1 búsqueda abierta"
                  : `Hay ${trabajos.length} búsquedas abiertas`}
            </h2>
            {trabajos.length > 0 ? (
              <p className="text-[16px] text-[#cfc4c5] leading-[1.6] max-w-[620px] mt-2">
                Postularte no te compromete a nada: es avisar que te interesa. Si
                te eligen, te llega una oferta con el monto y las condiciones, y
                ahí decidís.
              </p>
            ) : null}
          </header>

          <TrabajosClient trabajos={trabajos} />
        </div>
      </main>
    </div>
  );
}
