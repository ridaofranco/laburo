/**
 * Pantalla de creación de oferta (OFER-01), server component.
 *
 * Cuelga del perfil de candidato (Fase 2) via el CTA "Crear oferta". El (app)
 * layout ya bloquea a no-miembros; acá sólo cargamos datos con el cliente
 * autenticado (JWT), que la RLS de staff_app scopea a la org del caller:
 *  - el candidato desde public.staff_app_profiles (.eq(id).maybeSingle()),
 *    notFound() si no existe / no es de la org.
 *  - los gigs existentes desde public.staff_app_gigs (vista security_invoker,
 *    RLS is_org_member) para el paso "elegir un gig".
 *
 * NO se escribe nada acá: todo el WRITE (crear gig quick + oferta + token) pasa
 * por la RPC SECURITY DEFINER via el server action (Task 2), nunca por un insert
 * directo del cliente (Pitfall 1: staff_app no está en PostgREST + REVOKE).
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { initials } from "@/lib/avatar-color";
import { OfferForm, type OfferFormCandidate, type OfferFormGig } from "./offer-form";

export default async function OfferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: candidateData } = await supabase
    .from("staff_app_profiles")
    .select("id,nombre,apellido,telefono,email,oficios")
    .eq("id", id)
    .maybeSingle();

  if (!candidateData) notFound();
  const candidate = candidateData as OfferFormCandidate;

  const { data: gigsData } = await supabase
    .from("staff_app_gigs")
    .select("id,title,starts_at,venue_name")
    .order("starts_at", { ascending: false });

  const gigs = (gigsData ?? []) as OfferFormGig[];

  const nombreCompleto =
    [candidate.nombre, candidate.apellido].filter(Boolean).join(" ").trim() ||
    "Sin nombre";

  return (
    <div className="flex flex-col gap-lg pb-lg">
      {/* Volver al perfil */}
      <Link
        href={`/staff/${id}`}
        className="inline-flex items-center gap-xs min-h-[44px] -ml-1 text-fg-muted text-label font-semibold"
      >
        <ChevronLeft size={18} aria-hidden="true" />
        Volver al perfil
      </Link>

      {/* Encabezado: a quién le estás armando la oferta */}
      <header className="flex items-center gap-md">
        <span
          aria-hidden="true"
          className="shrink-0 grid place-items-center w-11 h-11 rounded-full bg-surface-2 text-body font-semibold text-fg"
        >
          {initials(candidate.nombre, candidate.apellido)}
        </span>
        <div className="flex-1 min-w-0 flex flex-col gap-xs">
          <h1 className="text-heading font-semibold text-fg">Crear oferta</h1>
          <p className="text-label text-fg-muted truncate">
            Para {nombreCompleto}
          </p>
        </div>
      </header>

      <OfferForm candidate={candidate} gigs={gigs} />
    </div>
  );
}
