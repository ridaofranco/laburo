/**
 * Fichaje del STAFF (fork "staff con cuenta") con DATOS REALES. Gate por identidad
 * (requireStaff). Lista los eventos donde el staff está CONFIRMADO (ofertas
 * aceptadas) y permite fichar entrada/salida por GPS (check-in/out RPC). Chrome
 * propio del staff (StaffNav). Estilos Stitch.
 */

export const dynamic = "force-dynamic";

import { StaffNav } from "@/components/staff-nav";
import { requireStaff, getMyStaffOffers } from "@/lib/staff";
import { FichajeClient, type FichajeGig } from "./fichaje-client";


export default async function FichajePage() {
  await requireStaff();
  const offers = await getMyStaffOffers();

  // Solo confirmados con gig; dedup por gig (un gig = una jornada de fichaje).
  const seen = new Set<string>();
  const gigs: FichajeGig[] = [];
  for (const o of offers) {
    if (o.status !== "accepted" || !o.gig_id) continue;
    if (seen.has(o.gig_id)) continue;
    seen.add(o.gig_id);
    gigs.push({
      gigId: o.gig_id,
      title: o.gig_title?.trim() || "Evento",
      venue: o.gig_venue,
      startsAt: o.gig_starts_at,
      checkInAt: o.check_in_at,
      checkOutAt: o.check_out_at,
    });
  }

  return (
    <div className="min-h-dvh bg-[#131313] text-[#e5e2e1] antialiased flex flex-col md:flex-row">
      <StaffNav />
      <main className="flex-1 w-full md:pl-[280px] pt-16 md:pt-0 pb-[100px] md:pb-0">
        <div className="max-w-[1100px] mx-auto px-6 md:px-20 py-12 md:py-24 flex flex-col gap-10">
          <header className="border-b border-[#1A1A1A] pb-6">
            <p className="label-tech text-[12px] uppercase tracking-[0.2em] text-[#c6c6c6] mb-3">
              Fichaje
            </p>
            <h1 className="t-display text-[#e5e2e1] uppercase">
              Entrada y salida
            </h1>
            <p className="text-[16px] text-[#cfc4c5] mt-4 max-w-[560px] leading-[1.6]">
              Registrá tu entrada al llegar y tu salida al terminar. Tomamos tu
              ubicación en ese momento para dejar constancia.
            </p>
          </header>
          <FichajeClient gigs={gigs} />
        </div>
      </main>
    </div>
  );
}
