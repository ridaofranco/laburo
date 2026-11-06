"use server";

/**
 * Búsquedas de un evento (lado productora). Todo por las RPC de la 0053: el
 * schema staff_app no es alcanzable por PostgREST, y además cada RPC vuelve a
 * chequear `is_org_writer` contra la organización DEL GIG, así que un id que
 * venga trucado desde el browser no alcanza para escribir en el evento de otro.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { filtrarAviso } from "@/lib/filtro-avisos";
import { alerta } from "@/lib/alerta";
import { siteUrl } from "@/lib/site";
import { validarDocumento } from "@/lib/documento";

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
  input: {
    role: string;
    cupo: number;
    pago: number | null;
    notas: string | null;
    publicar: boolean;
    declaracion?: boolean;
    condiciones?: Partial<Record<"horario" | "vestimenta" | "comida" | "traslado" | "forma_pago" | "plazo_pago", string>>;
    docTipo?: string;
    docNumero?: string;
  },
) {
  // Declaración jurada obligatoria (Franco 31/10: LABURO no contrata ni intermedia).
  // Se valida acá porque una server action es un POST invocable: la casilla sola no alcanza.
  if (input.declaracion !== true) {
    return { ok: false, error: "Para publicar tenés que aceptar la declaración jurada." };
  }
  if (input.publicar && (await gigTerminado(gigId))) return { ok: false, error: YA_TERMINO };

  // Filtro de palabras (fase 2, punto 7): lo prohibido no se guarda; lo dudoso se
  // crea pero queda bajado «en revisión» hasta que se aprueba en /plataforma.
  const cond = input.condiciones ?? {};
  // El filtro de palabras mira TODO lo que se publica, también las condiciones.
  const textoCond = Object.values(cond).filter(Boolean).join(" · ");
  const filtro = filtrarAviso({ role: input.role, notas: [input.notas, textoCond].filter(Boolean).join(" · ") || null });
  if (filtro.nivel === "prohibido") return { ok: false, error: filtro.mensaje };

  // CUIT o DNI de quien publica (fase 2, punto 6): las organizaciones de antes
  // de la 0107 lo cargan acá, una sola vez. Tabla privada, solo service_role.
  const supabase = await createClient();
  const admin = createServiceRoleClient();
  const { data: gigOrg } = await supabase.from("staff_app_gigs").select("organization_id").eq("id", gigId).maybeSingle();
  const orgId = (gigOrg as { organization_id?: string } | null)?.organization_id;
  if (!orgId) return { ok: false, error: motivo("gig_inexistente") };
  const { data: tieneDoc, error: errTiene } = await admin.rpc("staff_app_org_identidad_tiene", { p_org: orgId });
  if (errTiene) console.error("[busquedas] no se pudo ver si tiene documento:", errTiene.message);
  if (!errTiene && tieneDoc === false) {
    const doc = validarDocumento(input.docTipo ?? "", input.docNumero ?? "");
    if (!doc.ok) return { ok: false, error: `Antes de publicar, cargá el CUIT o DNI de quien publica. ${doc.error}` };
    const { error: errDoc } = await admin.rpc("staff_app_org_identidad_guardar", { p_org: orgId, p_tipo: doc.tipo, p_numero: doc.numero });
    if (errDoc) {
      console.error("[busquedas] no se guardó el documento:", errDoc.message);
      return { ok: false, error: "No se pudo guardar el CUIT o DNI. Probá de nuevo." };
    }
  }

  const { data, error } = await supabase.rpc("staff_app_crear_busqueda", {
    p_gig_id: gigId,
    p_role: input.role,
    p_cupo: input.cupo,
    p_pago: input.pago,
    p_notas: input.notas,
    p_publicar: input.publicar,
  });
  if (error) {
    console.error("[busquedas] staff_app_crear_busqueda falló:", error.message);
    return { ok: false, error: "No se pudo. Probá de nuevo." };
  }
  const r = data as { ok?: boolean; reason?: string; id?: string } | null;
  if (!r?.ok) return { ok: false, error: motivo(r?.reason) };

  if (r.id && textoCond) {
    // El id lo devolvió staff_app_crear_busqueda, que ya chequeó is_org_writer.
    const { error: errCond } = await admin.rpc("staff_app_busqueda_condiciones", {
      p_opening_id: r.id,
      p_horario: cond.horario ?? null,
      p_vestimenta: cond.vestimenta ?? null,
      p_comida: cond.comida ?? null,
      p_traslado: cond.traslado ?? null,
      p_forma_pago: cond.forma_pago ?? null,
      p_plazo_pago: cond.plazo_pago ?? null,
    });
    if (errCond) console.error("[busquedas] no se guardaron las condiciones:", errCond.message);
  }

  let enRevision = false;
  if (filtro.nivel === "dudoso" && r.id) {
    const { error: errRev } = await admin.rpc("staff_app_busqueda_a_revision", {
      p_opening_id: r.id,
      p_motivo: filtro.motivo,
    });
    if (errRev) console.error("[busquedas] no se pudo pasar a revisión:", errRev.message);
    else enRevision = true;
    await alerta({
      titulo: "LABURO: búsqueda en revisión",
      clave: `busqueda-revision:${r.id}`,
      aviso: true,
      datos: { rol: input.role, detalle: [input.notas, textoCond].filter(Boolean).join(" · "), motivo: filtro.motivo, revisar: siteUrl("/plataforma") },
    });
  }
  revalidatePath(`/tablero/${gigId}/busquedas`);
  const aviso =
    enRevision && filtro.nivel === "dudoso"
      ? `Quedó guardada pero en revisión: ${filtro.motivo.replace(/^En revisión: /, "")}. La miramos en 48 a 72 h y, si está bien, se publica.`
      : undefined;
  return { ok: true, enRevision, aviso };
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
