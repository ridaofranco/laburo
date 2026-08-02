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

export async function crearBusqueda(
  gigId: string,
  input: { role: string; cupo: number; pago: number | null; notas: string | null; publicar: boolean },
) {
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
