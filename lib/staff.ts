import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Helpers del lado STAFF (fork "staff con cuenta"). La identidad se resuelve por
 * email verificado vía los RPC SECURITY DEFINER staff_app_my_staff_* (0012): el
 * staff solo ve/edita lo suyo. requireStaff() es el gate: sin sesión o sin perfil
 * de staff con ese email, redirige a /acceso-staff.
 */

export interface StaffProfile {
  id: string;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
  telefono: string | null;
  documento: string | null;
  fecha_nacimiento: string | null;
  oficios: string[] | null;
  oficios_otro: string | null;
  provincia: string | null;
  ciudad: string | null;
  pais_residencia: string | null;
  donde_trabajar: string[] | null;
  situacion_legal: string | null;
  disponibilidad_aviso: string | null;
  disponibilidad_finde: boolean | null;
  disponibilidad_viajar: boolean | null;
  movilidad_propia: boolean | null;
  experiencia: boolean | null;
  anios_experiencia: string | null;
  experiencia_detalle: string | null;
  eventos_trabajados: number | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  cv_url: string | null;
  motivacion: string | null;
}

export interface StaffOffer {
  id: string;
  role: string | null;
  status: string | null;
  amount: number | null;
  conditions: string | null;
  expires_at: string | null;
  sent_at: string | null;
  responded_at: string | null;
  gig_id: string | null;
  gig_title: string | null;
  gig_starts_at: string | null;
  gig_ends_at: string | null;
  gig_venue: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
}

/** Perfil de staff del caller, o null si no hay sesión / no es staff. */
export async function getMyStaffProfile(): Promise<StaffProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.rpc("staff_app_my_staff_profile");
  return (data as StaffProfile | null) ?? null;
}

/** Ofertas del staff (con gig + asistencia). Vacío si no es staff. */
export async function getMyStaffOffers(): Promise<StaffOffer[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("staff_app_my_staff_offers");
  return (data as StaffOffer[] | null) ?? [];
}

/**
 * Gate del lado staff: exige sesión + perfil de staff con ese email.
 * Redirige a /acceso-staff si no. Devuelve el perfil para usarlo en la página.
 */
export async function requireStaff(): Promise<StaffProfile> {
  const profile = await getMyStaffProfile();
  if (!profile) redirect("/acceso-staff");
  return profile;
}

/** "Aceptada" | "Vencida" | "Vista" | "Enviada" | "Rechazada" — misma regla que el productor. */
export function offerLabel(o: { status: string | null; expires_at: string | null }): string {
  if (o.status === "accepted") return "Aceptada";
  if (o.status === "declined") return "Rechazada";
  if (o.expires_at && new Date(o.expires_at).getTime() <= Date.now()) return "Vencida";
  if (o.status === "viewed") return "Vista";
  return "Enviada";
}
