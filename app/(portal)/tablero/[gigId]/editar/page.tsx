/**
 * Editar evento (productor). Trae el gig por id (RLS is_org_member) y monta el
 * GigForm prefilled. Si no existe / no es del org, vuelve al tablero.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GigForm, type GigInitial } from "../../gig-form";

export const dynamic = "force-dynamic";

export default async function EditarEventoPage({
  params,
}: {
  params: Promise<{ gigId: string }>;
}) {
  const { gigId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_app_gigs")
    .select("id,title,starts_at,ends_at,venue_name,client_budget,venue_address,venue_lat,venue_lng")
    .eq("id", gigId)
    .maybeSingle();
  if (error) console.error("[editar evento] no se pudo leer gig:", error.message);

  if (!data) redirect("/tablero");

  const { data: slotsData, error: slotsError } = await supabase
    .from("staff_app_gig_slots")
    .select("role,quantity")
    .eq("gig_id", gigId);
  if (slotsError) console.error("[editar evento] no se pudo leer gig_slots:", slotsError.message);

  return (
    <GigForm
      initial={{ ...data, slots: (slotsData ?? []) as { role: string; quantity: number }[] } as GigInitial}
    />
  );
}
