"use server";

/**
 * Búsquedas de un evento (lado productora). Todo por las RPC de la 0053: el
 * schema staff_app no es alcanzable por PostgREST, y además cada RPC vuelve a
 * chequear `is_org_writer` contra la organización DEL GIG, así que un id que
 * venga trucado desde el browser no alcanza para escribir en el evento de otro.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function motivo(reason: string | undefined): string {
  switch (reason) {
    case "sin_permiso":
      return "No tenés permiso para editar este evento.";
    case "gig_inexistente":
    case "inexistente":
      return "Ese evento o esa búsqueda ya no existe.";
    case "falta_rol":
      return "Escribí qué rol estás buscando.";
    case "cupo_invalido":
      return "El cupo tiene que ser al menos 1.";
    default:
      return "No se pudo. Probá de nuevo.";
  }
}

async function llamar(
  fn: string,
  args: Record<string, unknown>,
  gigId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    console.error(`[busquedas] ${fn} falló:`, error.message);
    return { ok: false, error: "No se pudo. Probá de nuevo." };
  }
  const r = data as { ok?: boolean; reason?: string } | null;
  if (!r?.ok) return { ok: false, error: motivo(r?.reason) };
  revalidatePath(`/tablero/${gigId}/busquedas`);
  return { ok: true };
}

/**
 * ¿El evento ya terminó? (31/10) Publicar una búsqueda de un evento pasado la
 * mostraba al pool para algo que ya no existe. Fin cargado: terminó si ya pasó.
 * Sin fin: 12 h después del inicio (la misma regla del panel del staff).
 */
export async function eventoTerminado(gig: { starts_at: string | null; ends_at: string | null }): Promise<boolean> {
  const ahora = Date.now();
  if (gig.ends_at) return new Date(gig.ends_at).getTime() < ahora;
  if (gig.starts_at) return new Date(gig.starts_at).getTime() < ahora - 12 * 3600 * 1000;
  return false;
}

const YA_TERMINO = "Ese evento ya terminó: no se puede publicar una búsqueda. Si es otra fecha, creá un evento nuevo.";

async function gigTerminado(gigId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_app_gigs")
    .select("starts_at,ends_at")
    .eq("id", gigId)
    .maybeSingle();
  if (error) console.error("[busquedas] no se pudo leer la fecha del evento:", error.message);
  return data ? eventoTerminado(data as { starts_at: string | null; ends_at: string | null }) : false;
}

export async function crearBusqueda(
  gigId: string,
  input: { role: string; cupo: number; pago: number | null; notas: string | null; publicar: boolean },
) {
  if (input.publicar && (await gigTerminado(gigId))) return { ok: false, error: YA_TERMINO };
  return llamar(
    "staff_app_crear_busqueda",
    {
      p_gig_id: gigId,
      p_role: input.role,
      p_cupo: input.cupo,
      p_pago: input.pago,
      p_notas: input.notas,
      p_publicar: input.publicar,
    },
    gigId,
  );
}

export async function publicarBusqueda(gigId: string, openingId: string, publicar: boolean) {
  if (publicar && (await gigTerminado(gigId))) return { ok: false, error: YA_TERMINO };
  return llamar(
    "staff_app_publicar_busqueda",
    { p_opening_id: openingId, p_publicar: publicar },
    gigId,
  );
}

export async function cerrarBusqueda(gigId: string, openingId: string, cerrar: boolean) {
  return llamar(
    "staff_app_cerrar_busqueda",
    { p_opening_id: openingId, p_cerrar: cerrar },
    gigId,
  );
}

export async function marcarPostulacion(gigId: string, applicationId: string, estado: string) {
  return llamar(
    "staff_app_marcar_postulacion",
    { p_application_id: applicationId, p_estado: estado },
    gigId,
  );
}
