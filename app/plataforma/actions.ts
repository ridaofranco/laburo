"use server";

/**
 * EL PANEL DE PLATAFORMA (Fase 0). Lo que ve SOMOS DER por encima de todas las
 * productoras.
 *
 * Existe por una decisión de Franco del 2/8: nadie aprueba nada antes de
 * publicar. Es la decisión correcta, la fricción mata un marketplace. Pero al no
 * aprobar, VER es lo único que queda. Si no ve lo que se publica, no se entera
 * nunca.
 *
 * Todo pasa por las RPC de la 0054, que chequean `is_platform_admin()` adentro.
 * Acá no se decide ningún permiso: si el caller no es de la plataforma, las RPC
 * devuelven vacío y esta pantalla queda en blanco.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { iniciarSuplantacion } from "@/lib/suplantacion";

export interface Resumen {
  ok: boolean;
  organizaciones?: number;
  personas?: number;
  proveedores?: number;
  busquedas_vivas?: number;
  postulaciones?: number;
  contrataciones?: number;
}

export interface BusquedaPlataforma {
  id: string;
  organizacion: string;
  role: string;
  cupo: number;
  pago: number | null;
  notas: string | null;
  publicado_at: string | null;
  cerrado_at: string | null;
  moderada_at: string | null;
  moderada_motivo: string | null;
  gig_title: string | null;
  gig_starts_at: string | null;
  postulados: number;
}

export interface Contratacion {
  id: string;
  organizacion: string;
  persona: string;
  persona_id: string;
  role: string | null;
  amount: number | null;
  responded_at: string | null;
  gig_title: string | null;
  gig_starts_at: string | null;
  pago_listo_at: string | null;
}

export interface OrgPlataforma {
  id: string;
  name: string;
  slug: string | null;
  activa: boolean;
  es_plataforma: boolean;
  /**
   * Qué tipo de organización es (0072). ⚠️ Puede llegar `undefined` mientras la
   * migración no esté aplicada, no solo `null`: la base y el deploy se aplican
   * por separado en este repo, a propósito. Por eso el tipo lo admite y la
   * pantalla trata los dos casos igual, como "sin clasificar".
   */
  categoria?: string | null;
  created_at: string;
  miembros: number;
  eventos: number;
  busquedas: number;
  contrataciones: number;
}

export async function getResumen(): Promise<Resumen> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("staff_app_plataforma_resumen");
  return (data as Resumen | null) ?? { ok: false };
}

export async function getBusquedas(): Promise<BusquedaPlataforma[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("staff_app_plataforma_busquedas");
  return (data as BusquedaPlataforma[] | null) ?? [];
}

export async function getContrataciones(): Promise<Contratacion[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("staff_app_plataforma_contrataciones");
  return (data as Contratacion[] | null) ?? [];
}

export async function getOrganizaciones(): Promise<OrgPlataforma[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("staff_app_plataforma_organizaciones");
  return (data as OrgPlataforma[] | null) ?? [];
}

/**
 * Entrar a operar una productora (0073).
 *
 * ⚠️ El permiso NO se decide acá. `iniciarSuplantacion` llama a
 * `staff_app_actuar_como`, cuyo gate es `is_platform_admin()` adentro de la
 * base. Este archivo es "use server", o sea que sus exports son endpoints POST
 * invocables: si el gate viviera acá, alcanzaría con llamarlo a mano.
 */
export async function actuarComo(
  orgId: string,
  motivo: string,
): Promise<{ ok: boolean; error?: string }> {
  const r = await iniciarSuplantacion(orgId, motivo);
  if (!r.ok) return r;
  // Redibuja el portal entero: cambia la organización, el menú y el banner.
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function moderar(
  openingId: string,
  bajar: boolean,
  motivo?: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_app_plataforma_moderar", {
    p_opening_id: openingId,
    p_bajar: bajar,
    p_motivo: motivo?.trim() || null,
  });
  if (error) {
    console.error("[plataforma] moderar falló:", error.message);
    return { ok: false, error: "No se pudo. Probá de nuevo." };
  }
  const r = data as { ok?: boolean; reason?: string } | null;
  if (!r?.ok) {
    return {
      ok: false,
      error:
        r?.reason === "falta_motivo"
          ? "Escribí por qué la bajás."
          : r?.reason === "sin_permiso"
            ? "No sos administrador de la plataforma."
            : "No se pudo. Probá de nuevo.",
    };
  }
  revalidatePath("/plataforma");
  return { ok: true };
}

/**
 * ── PROVEEDORES ────────────────────────────────────────────────────────────
 * El control de la alta abierta (0060). El proveedor se publica solo y al
 * toque; esto es lo que permite sacarlo. Sin esto, el aviso que llega cuando
 * alguien se registra sería un aviso sin botón.
 */

export interface ProveedorPlataforma {
  id: string;
  nombre: string;
  slug: string | null;
  email: string;
  headline: string | null;
  bio: string | null;
  ciudad: string | null;
  provincia: string | null;
  is_public: boolean;
  activo: boolean;
  origen: string | null;
  created_at: string;
  moderado_at: string | null;
  moderado_motivo: string | null;
  servicios: number;
  consultas: number;
}

export async function getProveedores(): Promise<ProveedorPlataforma[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("staff_app_plataforma_proveedores");
  return (data as ProveedorPlataforma[] | null) ?? [];
}

export async function moderarProveedor(
  profileId: string,
  bajar: boolean,
  motivo?: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_app_plataforma_moderar_proveedor", {
    p_profile_id: profileId,
    p_bajar: bajar,
    p_motivo: motivo?.trim() || null,
  });
  if (error) {
    console.error("[plataforma] moderarProveedor falló:", error.message);
    return { ok: false, error: "No se pudo. Probá de nuevo." };
  }
  const r = data as { ok?: boolean; reason?: string } | null;
  if (!r?.ok) {
    return {
      ok: false,
      error:
        r?.reason === "falta_motivo"
          ? "Escribí por qué lo bajás."
          : r?.reason === "sin_permiso"
            ? "No sos administrador de la plataforma."
            : "No se pudo. Probá de nuevo.",
    };
  }
  revalidatePath("/plataforma/proveedores");
  revalidatePath("/servicios");
  return { ok: true };
}

/** La plata de UNA productora, vista desde la plataforma (migración 0068). */
export interface RentabilidadOrg {
  id: string;
  name: string | null;
  slug: string | null;
  es_plataforma: boolean | null;
  eventos: number;
  /** null = todavía no cargó cuánto le cobra al cliente. NO es cero. */
  ingreso: number | null;
  costo: number | null;
  margen: number | null;
  ofertas_mandadas: number;
  ofertas_aceptadas: number;
  ultimo_movimiento: string | null;
}

/**
 * La rentabilidad de TODAS las productoras.
 *
 * Es lo único de "ver todo de todos" que no existía: el resto de esta pantalla
 * ya era cruzado desde la 0054. La RPC chequea `is_platform_admin()` adentro y
 * le devuelve `[]` a cualquier otro, así que el permiso no se decide acá.
 */
export async function getRentabilidadCruzada(): Promise<RentabilidadOrg[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("staff_app_plataforma_rentabilidad");
  return (data as RentabilidadOrg[] | null) ?? [];
}

/** Una consulta a un proveedor o salón, vista desde la plataforma (0070). */
export interface ConsultaPlataforma {
  id: string;
  created_at: string;
  origen: string | null;
  quien: string | null;
  email: string | null;
  telefono: string | null;
  a_quien: string | null;
  tipo_destino: string | null;
  slug: string | null;
  /** false = la consulta existe pero el proveedor NUNCA se enteró. */
  mail_salio: boolean;
  organizacion: string | null;
  respuestas: { label: string; valor: string }[] | null;
}

/** Una oferta de trabajo, con en qué quedó (0070). */
export interface OfertaPlataforma {
  id: string;
  sent_at: string | null;
  responded_at: string | null;
  expires_at: string | null;
  monto: number | null;
  /** 'vencida' NO está en la tabla: se deriva de expires_at. */
  estado: string | null;
  a_quien: string | null;
  evento: string | null;
  organizacion: string | null;
}

/** Un hecho de la línea de tiempo (0070/0071). */
export interface HechoPlataforma {
  cuando: string;
  que: string;
  quien: string | null;
  detalle: string | null;
  org: string | null;
}

export async function getConsultasPlataforma(): Promise<ConsultaPlataforma[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("staff_app_plataforma_consultas");
  return (data as ConsultaPlataforma[] | null) ?? [];
}

export async function getOfertasPlataforma(): Promise<OfertaPlataforma[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("staff_app_plataforma_ofertas");
  return (data as OfertaPlataforma[] | null) ?? [];
}

/**
 * "Qué pasó en LABURO", todo junto y ordenado.
 *
 * Es la que contesta el pedido de Franco: *"no se me puede pasar nada"*. Las
 * otras pantallas obligan a ir a buscar; esta trae.
 */
export async function getTimelinePlataforma(dias = 30): Promise<HechoPlataforma[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("staff_app_plataforma_timeline", { p_dias: dias });
  return (data as HechoPlataforma[] | null) ?? [];
}
