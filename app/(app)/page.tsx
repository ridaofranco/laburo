/**
 * Búsqueda (SRCH-01/02/03) — server component.
 *
 * UNA sola query server-side contra public.staff_app_profiles (vista
 * security_invoker, RLS como el JWT de Franco). Selecciona SOLO las columnas de
 * card (payload chico, T-02-12), aplica oficios overlap (GIN) + texto ilike
 * parametrizado + toggles .eq + exclusión de crew_busy (SRCH-02) + paginación.
 */
import { createClient } from "@/lib/supabase/server";
import {
  parseSearchParams,
  type RawSearchParams,
} from "@/lib/search-params";

/** Columnas de card (NO motivacion/experiencia_detalle — payload chico). */
export interface StaffCard {
  id: string;
  nombre: string | null;
  apellido: string | null;
  oficios: string[] | null;
  oficios_otro: string | null;
  provincia: string | null;
  ciudad: string | null;
  experiencia: boolean | null;
  anios_experiencia: number | null;
  eventos_trabajados: number | null;
}

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

  const { data, error } = await query.order("nombre").range(0, 49);
  const candidates = (data ?? []) as StaffCard[];

  return (
    <section className="flex flex-col gap-md">
      <h1 className="text-heading font-semibold text-fg">Buscá gente</h1>
      {error ? (
        <p className="text-body text-fg-muted">
          No pudimos cargar los candidatos.
        </p>
      ) : (
        <ul className="flex flex-col gap-sm">
          {candidates.map((c) => (
            <li key={c.id} className="text-body text-fg">
              {c.nombre} {c.apellido}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
