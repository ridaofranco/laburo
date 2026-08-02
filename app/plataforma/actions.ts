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
