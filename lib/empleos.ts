/**
 * Bolsa de trabajo pública (0111): las búsquedas abiertas, sin cuenta.
 * Lectura por las RPC anon staff_app_empleos_publicos / staff_app_empleo_publico.
 */

import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface EmpleoPublico {
  id: string;
  role: string;
  cupo: number;
  pago: number | null;
  notas: string | null;
  horario: string | null;
  vestimenta: string | null;
  comida: string | null;
  traslado: string | null;
  forma_pago: string | null;
  plazo_pago: string | null;
  evento: string | null;
  empieza: string | null;
  termina: string | null;
  lugar: string | null;
  publica: string | null;
  publicado_at: string | null;
}

export async function getEmpleosPublicos(): Promise<EmpleoPublico[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_app_empleos_publicos");
  if (error) throw new Error(`[empleos] no se pudo leer la lista: ${error.message}`);
  return (data as EmpleoPublico[] | null) ?? [];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getEmpleoPublico(id: string): Promise<EmpleoPublico | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_app_empleo_publico", { p_id: id });
  if (error) throw new Error(`[empleos] no se pudo leer la búsqueda: ${error.message}`);
  return (data as EmpleoPublico | null) ?? null;
}

/** ¿Quien mira ya tiene sesión? Decide a dónde lleva el botón de postularse. */
export async function haySesion(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return Boolean(data.user);
}

/** Primera letra en mayúscula: las búsquedas se cargan como vienen («armadores de stands»). */
export function capitalizar(s: string | null | undefined): string {
  const t = (s ?? "").trim();
  return t ? t[0].toLocaleUpperCase("es-AR") + t.slice(1) : "";
}

/** Las condiciones que la búsqueda tiene cargadas, en el orden en que se leen. */
export function condiciones(e: EmpleoPublico): [string, string][] {
  return (
    [
      ["Horario", e.horario],
      ["Vestimenta", e.vestimenta],
      ["Comida", e.comida],
      ["Traslado", e.traslado],
      ["Forma de pago", e.forma_pago],
      ["Plazo de pago", e.plazo_pago],
    ] as [string, string | null][]
  ).filter((x): x is [string, string] => Boolean(x[1]?.trim()));
}
