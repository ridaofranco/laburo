/**
 * Calendario Maestro (server wrapper). Trae los gigs reales del org
 * (RLS-scopeado) + el conteo de confirmados por gig (ofertas aceptadas) y se lo
 * pasa al <CalendarioClient>, que hace la grilla mensual navegable. Datos reales,
 * cero mock. El layout del portal ya pone el sidebar + <main md:pl-[280px]>.
 */

import { createClient } from "@/lib/supabase/server";
import { CalendarioClient, type CalGig } from "./calendario-client";
import { LoadError } from "@/components/load-error";

export default async function CalendarioPage() {
  const supabase = await createClient();

  const [{ data: gigsData, error: gigsError }, { data: offersData }] = await Promise.all([
    supabase
      .from("staff_app_gigs")
      .select("id,title,starts_at,ends_at,venue_name")
      .order("starts_at", { ascending: true }),
    supabase.from("staff_app_offers").select("gig_id,status"),
  ]);

  if (gigsError) {
    return (
      <div className="max-w-[1440px] mx-auto w-full px-6 md:px-20 py-16 md:py-24">
        <LoadError what="el calendario" />
      </div>
    );
  }

  const offers = (offersData ?? []) as { gig_id: string | null; status: string | null }[];
  const acceptedByGig = new Map<string, number>();
  for (const o of offers) {
    if (o.status === "accepted" && o.gig_id) {
      acceptedByGig.set(o.gig_id, (acceptedByGig.get(o.gig_id) ?? 0) + 1);
    }
  }

  const gigs: CalGig[] = (gigsData ?? []).map(
    (g: {
      id: string;
      title: string | null;
      starts_at: string | null;
      ends_at: string | null;
      venue_name: string | null;
    }) => ({
      ...g,
      confirmed: acceptedByGig.get(g.id) ?? 0,
    }),
  );

  return <CalendarioClient gigs={gigs} />;
}
