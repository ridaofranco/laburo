/**
 * Tablero de cobertura por gig (STAT-02), server component.
 *
 * Con el CLIENTE AUTENTICADO (createClient de @/lib/supabase/server) hace dos
 * lecturas RLS-scopeadas (is_org_member scopea ambas al org del caller):
 *  - public.staff_app_gigs → todos los eventos del org (incluye los que aún no
 *    tienen ninguna oferta, para que aparezcan como "sin ofertas todavía").
 *  - public.staff_app_offers → las ofertas (con staff_nombre/apellido por 05-01).
 *
 * El left-join se hace en memoria (agrupar ofertas por gig_id) y se pasa ya
 * agrupado a <GigBoard>. La etiqueta derivada ("Vencida" = now()>expires_at) y
 * la cobertura NO se calculan acá: las deriva el client reusando offerLabel().
 */

import { createClient } from "@/lib/supabase/server";
import {
  GigBoard,
  type BoardGig,
  type BoardGigMeta,
  type BoardOffer,
} from "./gig-board";

export default async function TableroPage() {
  const supabase = await createClient();

  const [{ data: gigsData }, { data: offersData }] = await Promise.all([
    supabase
      .from("staff_app_gigs")
      .select("id,title,starts_at,ends_at,venue_name,status")
      .order("starts_at", { ascending: false }),
    supabase
      .from("staff_app_offers")
      .select(
        "id,gig_id,staff_profile_id,role,status,expires_at,sent_at,responded_at,gig_title,staff_nombre,staff_apellido",
      ),
  ]);

  const gigs = (gigsData ?? []) as BoardGigMeta[];
  const offers = (offersData ?? []) as BoardOffer[];

  // Left-join en memoria: agrupar ofertas por gig_id (Map).
  const byGig = new Map<string, BoardOffer[]>();
  for (const o of offers) {
    if (!o.gig_id) continue;
    const list = byGig.get(o.gig_id);
    if (list) list.push(o);
    else byGig.set(o.gig_id, [o]);
  }

  // Gigs ya vienen ordenados (próximos primero) por la query; los sin ofertas
  // quedan con offers vacío y el board los muestra como "sin ofertas todavía".
  const board: BoardGig[] = gigs.map((gig) => ({
    gig,
    offers: byGig.get(gig.id) ?? [],
  }));

  return (
    <div className="max-w-[1440px] mx-auto w-full px-6 md:px-20 py-12 md:py-20 pb-32 md:pb-20">
      <header className="flex flex-col gap-4 border-b border-[#1A1A1A] pb-8 mb-10">
        <p className="label-tech text-[12px] text-[#cfc4c5]">Operaciones</p>
        <h1 className="font-[family-name:var(--font-syne)] text-[clamp(2.5rem,7vw,72px)] font-extrabold tracking-tight uppercase leading-none text-[#e5e2e1]">
          Gestión de Eventos
        </h1>
        <p className="text-[16px] text-[#cfc4c5] max-w-[560px]">
          Mirá de un vistazo qué roles están cubiertos y cuáles seguís buscando.
        </p>
      </header>
      <GigBoard board={board} />
    </div>
  );
}
