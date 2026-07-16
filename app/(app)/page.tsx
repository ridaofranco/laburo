/**
 * Búsqueda (SRCH-01/02/03) — server component.
 *
 * UNA sola query server-side contra public.staff_app_profiles (vista
 * security_invoker, RLS como el JWT de Franco). Selecciona SOLO las columnas de
 * card (payload chico, T-02-12), aplica oficios overlap (GIN) + texto ilike
 * parametrizado + toggles .eq + exclusión de crew_busy (SRCH-02) + paginación.
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  parseSearchParams,
  type RawSearchParams,
} from "@/lib/search-params";
import { SearchClient } from "./search-client";
import type { StaffCard } from "./candidate-card";

const CARD_COLUMNS =
  "id,nombre,apellido,oficios,oficios_otro,provincia,ciudad,experiencia,anios_experiencia,eventos_trabajados";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const filters = parseSearchParams(raw);

  const supabase = await createClient();

  let query = supabase.from("staff_app_profiles").select(CARD_COLUMNS);

  // SRCH-01: oficios overlap (GIN-indexed), strings ya whitelisteadas (V5).
  if (filters.oficios.length) {
    query = query.overlaps("oficios", filters.oficios);
  }

  // Texto libre: ilike parametrizado sobre nombre/apellido/experiencia + zona.
  // filters.q ya viene saneado (sin caracteres que rompan el grammar de .or()).
  if (filters.q) {
    const t = filters.q;
    query = query.or(
      [
        `nombre.ilike.%${t}%`,
        `apellido.ilike.%${t}%`,
        `experiencia_detalle.ilike.%${t}%`,
        `oficios_otro.ilike.%${t}%`,
        `ciudad.ilike.%${t}%`,
        `provincia.ilike.%${t}%`,
      ].join(","),
    );
  }

  if (filters.provincia) query = query.eq("provincia", filters.provincia);
  if (filters.ciudad) query = query.ilike("ciudad", `%${filters.ciudad}%`);
  if (filters.finde) query = query.eq("disponibilidad_finde", true);
  if (filters.viajar) query = query.eq("disponibilidad_viajar", true);
  if (filters.movilidad) query = query.eq("movilidad_propia", true);

  // SRCH-02 (mínimo honesto): ocultar quienes ya están en crew de un gig.
  if (filters.ocultarAsignados) {
    const { data: busy } = await supabase
      .from("staff_app_crew_busy")
      .select("staff_profile_id");
    const ids = (busy ?? [])
      .map((r) => (r as { staff_profile_id: string }).staff_profile_id)
      .filter(Boolean);
    if (ids.length) {
      query = query.not("id", "in", `(${ids.join(",")})`);
    }
  }

  // XTRA-02 (modo "buscar reemplazo"): con ?gig=<uuid> ocultamos a quienes YA
  // recibieron una oferta para ese gig. Mismo molde EXACTO que crew_busy: leemos
  // los staff_profile_id de la vista RLS-scopeada y excluimos con
  // .not("id","in",(...)). El id ya viene validado como UUID (parseSearchParams,
  // T-5-12); los ids del .in() vienen de la vista, no del input crudo. Si la
  // lectura falla, degradamos en silencio (no bloqueamos la búsqueda).
  if (filters.gig) {
    const { data: ofertados } = await supabase
      .from("staff_app_offers")
      .select("staff_profile_id")
      .eq("gig_id", filters.gig);
    const ids = Array.from(
      new Set(
        (ofertados ?? [])
          .map((r) => (r as { staff_profile_id: string | null }).staff_profile_id)
          .filter((v): v is string => Boolean(v)),
      ),
    );
    if (ids.length) {
      query = query.not("id", "in", `(${ids.join(",")})`);
    }
  }

  const { data, error } = await query.order("nombre").range(0, 49);
  const candidates = (data ?? []) as StaffCard[];

  return (
    <>
      {filters.gig && (
        <div className="mb-md flex items-center justify-between gap-sm rounded-xl bg-surface-2 border border-border px-md py-sm">
          <span className="text-label text-fg-muted">
            Buscando reemplazo · ocultando a los que ya ofertaste
          </span>
          <Link
            href="/"
            className="shrink-0 inline-flex items-center min-h-[44px] text-accent text-label font-semibold"
          >
            Ver todos
          </Link>
        </div>
      )}
      <SearchClient
        candidates={candidates}
        error={Boolean(error)}
        initialFilters={filters}
      />
    </>
  );
}
