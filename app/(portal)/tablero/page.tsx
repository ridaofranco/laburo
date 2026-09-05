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

import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { orgActual } from "@/lib/org";
import {
  GigBoard,
  type BoardGig,
  type BoardGigMeta,
  type BoardOffer,
  type BoardAttendance,
} from "./gig-board";

export default async function TableroPage() {
  const supabase = await createClient();

  // ⚠️ SCOPE POR ORGANIZACIÓN ELEGIDA. La RLS filtra por MEMBRESÍA, así que a
  // quien es miembro de dos productoras le devuelve los eventos de las dos
  // mezclados. El selector de contexto dice en nombre de cuál está actuando y
  // la lectura tiene que respetarlo: si no, el tablero muestra los eventos de
  // la otra productora y el usuario los edita creyendo que son suyos.
  const org = await orgActual();
  // Un helper genérico acá hace que TypeScript se coma la inferencia de Supabase
  // (TS2589, "type instantiation is excessively deep"). Se escribe a mano: son
  // cuatro consultas y el filtro es una línea. Sin organización resuelta no se
  // filtra: `orgActual()` devolvió null y el layout ya cortó antes.
  const orgId = org?.organizationId ?? null;

  let qGigs = supabase
    .from("staff_app_gigs")
    .select("id,title,starts_at,ends_at,venue_name,status,client_budget,client_payment_status")
    .order("starts_at", { ascending: false });
  if (orgId) qGigs = qGigs.eq("organization_id", orgId);

  let qOffers = supabase
    .from("staff_app_offers")
    .select(
      "id,gig_id,staff_profile_id,role,status,expires_at,sent_at,responded_at,gig_title,staff_nombre,staff_apellido",
    );
  if (orgId) qOffers = qOffers.eq("organization_id", orgId);

  let qAtt = supabase
    .from("staff_app_attendance")
    .select("gig_id,staff_nombre,staff_apellido,check_in_at,check_out_at,check_in_distance_m");
  if (orgId) qAtt = qAtt.eq("organization_id", orgId);

  let qSlots = supabase.from("staff_app_gig_slots").select("gig_id,role,quantity");
  if (orgId) qSlots = qSlots.eq("organization_id", orgId);

  const [{ data: gigsData }, { data: offersData }, { data: attData }, { data: slotsData }] =
    await Promise.all([qGigs, qOffers, qAtt, qSlots]);

  const gigs = (gigsData ?? []) as BoardGigMeta[];
  const offers = (offersData ?? []) as BoardOffer[];
  const attendance = (attData ?? []) as BoardAttendance[];
  const slots = (slotsData ?? []) as { gig_id: string; role: string; quantity: number }[];

  // Dotación requerida por gig (suma de cantidades).
  const requiredByGig = new Map<string, number>();
  for (const s of slots) {
    if (!s.gig_id) continue;
    requiredByGig.set(s.gig_id, (requiredByGig.get(s.gig_id) ?? 0) + (Number(s.quantity) || 0));
  }

  // Left-join en memoria: agrupar ofertas por gig_id (Map).
  const byGig = new Map<string, BoardOffer[]>();
  for (const o of offers) {
    if (!o.gig_id) continue;
    const list = byGig.get(o.gig_id);
    if (list) list.push(o);
    else byGig.set(o.gig_id, [o]);
  }

  // Asistencia por gig.
  const attByGig = new Map<string, BoardAttendance[]>();
  for (const a of attendance) {
    if (!a.gig_id) continue;
    const list = attByGig.get(a.gig_id);
    if (list) list.push(a);
    else attByGig.set(a.gig_id, [a]);
  }

  // Gigs ya vienen ordenados (próximos primero) por la query; los sin ofertas
  // quedan con offers vacío y el board los muestra como "sin ofertas todavía".
  const board: BoardGig[] = gigs.map((gig) => ({
    gig,
    offers: byGig.get(gig.id) ?? [],
    attendance: attByGig.get(gig.id) ?? [],
    requiredTotal: requiredByGig.get(gig.id) ?? 0,
  }));

  return (
    <div className="max-w-[1440px] mx-auto w-full px-6 md:px-20 py-12 md:py-20 pb-32 md:pb-20">
      <header className="flex flex-col gap-4 border-b border-[#1A1A1A] pb-8 mb-10">
        <p className="label-tech text-[12px] text-[#cfc4c5]">Operaciones</p>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <h1 className="t-display uppercase text-[#e5e2e1]">
            Gestión de Eventos
          </h1>
          <Link
            href="/tablero/nuevo"
            className="shrink-0 inline-flex items-center justify-center gap-3 bg-[#e5e2e1] text-black label-tech text-[12px] uppercase tracking-widest px-8 py-4 border border-[#e5e2e1] hover:bg-transparent hover:text-[#e5e2e1] transition-colors w-full md:w-auto"
          >
            <CalendarPlus size={16} />
            Nuevo evento
          </Link>
        </div>
        <p className="text-[16px] text-[#cfc4c5] max-w-[560px]">
          Creá tus eventos, buscales el staff y seguí quién confirmó y quién ya
          fichó en el lugar.
        </p>
      </header>
      <GigBoard board={board} />
    </div>
  );
}
