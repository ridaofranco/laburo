/**
 * BÚSQUEDAS DE UN EVENTO (lado productora) — el otro lado del marketplace.
 *
 * Acá la productora dice qué necesita ("5 mozos, se paga tanto"), lo publica, y
 * ve quién levantó la mano. Sin esta pantalla, /trabajos le queda vacía al staff
 * para siempre.
 *
 * Lectura por las vistas `staff_app_busquedas` y `staff_app_postulaciones`, las
 * dos con security_invoker: la RLS decide qué filas ve cada uno, así que nadie
 * ve las búsquedas ni los postulados de otra productora.
 */

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BusquedasClient, type Busqueda, type Postulacion } from "./busquedas-client";

export default async function BusquedasPage({
  params,
}: {
  params: Promise<{ gigId: string }>;
}) {
  const { gigId } = await params;
  const supabase = await createClient();

  // El gig se lee por la vista con RLS: si no es de su organización, no existe
  // para esta persona y volvemos al tablero. No hace falta un chequeo aparte.
  const { data: gig } = await supabase
    .from("staff_app_gigs")
    .select("id,title,starts_at,venue_name")
    .eq("id", gigId)
    .maybeSingle();
  if (!gig) redirect("/tablero");

  const [{ data: busquedas }, { data: postulaciones }] = await Promise.all([
    supabase
      .from("staff_app_busquedas")
      .select("id,role,cupo,pago,notas,publicado_at,cerrado_at,postulados,sin_mirar")
      .eq("gig_id", gigId)
      .order("created_at", { ascending: true }),
    supabase
      .from("staff_app_postulaciones")
      .select("id,opening_id,staff_profile_id,estado,mensaje,nombre,apellido,ciudad,provincia,eventos_trabajados")
      .eq("gig_id", gigId)
      .order("created_at", { ascending: true }),
  ]);

  return (
    <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-10 md:py-16 flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <Link
          href="/tablero"
          className="inline-flex items-center gap-2 label-tech text-[11px] uppercase tracking-widest text-[#988e90] hover:text-[#e5e2e1] transition-colors w-fit"
        >
          <ArrowLeft size={14} /> Volver al tablero
        </Link>
        <p className="label-tech text-[12px] uppercase tracking-[0.2em] text-[#c6c6c6]">
          Búsquedas abiertas
        </p>
        <h1 className="t-display text-[#e5e2e1]">{gig.title || "Evento"}</h1>
        <p className="text-[16px] text-[#cfc4c5] leading-[1.6] max-w-[640px] mt-1">
          Publicá qué estás buscando y el pool de staff se postula solo. Después
          elegís entre gente que ya dijo que sí, en vez de escribirle a uno por
          uno.
        </p>
      </header>

      <BusquedasClient
        gigId={gigId}
        busquedas={(busquedas as Busqueda[] | null) ?? []}
        postulaciones={(postulaciones as Postulacion[] | null) ?? []}
      />
    </div>
  );
}
