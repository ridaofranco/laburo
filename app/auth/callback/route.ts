import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Callback de OAuth / magic link, compartido por el login del PRODUCTOR (/login)
 * y el del STAFF (/acceso-staff). Después de canjear el code por sesión, rutea por
 * IDENTIDAD:
 *   1. provision_member (idempotente): si el email está en la allowlist de admins,
 *      queda como miembro (productor) → /dashboard.
 *   2. si no es miembro pero su email matchea un perfil de staff (RPC
 *      staff_app_my_staff_profile, SECURITY DEFINER por email verificado) → /panel-staff.
 *   3. si no es ni una cosa ni la otra → /acceso-staff (no puede hacer nada; el gate
 *      de cada lado igual lo frena).
 * NO se accede al schema staff_app por PostgREST (PGRST106): todo por RPC/vistas.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) return NextResponse.redirect(`${origin}/login`);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login`);

  // 1. Productor (miembro del org).
  const membership = await supabase.rpc("staff_app_provision_member");
  if (membership.data) {
    return NextResponse.redirect(`${origin}/dashboard`);
  }
  const { data: existing } = await supabase
    .from("staff_app_my_membership")
    .select("role")
    .maybeSingle();
  if (existing) {
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  // 2. Staff (email matchea un perfil).
  const { data: staff } = await supabase.rpc("staff_app_my_staff_profile");
  if (staff) {
    return NextResponse.redirect(`${origin}/panel-staff`);
  }

  // 3. Ni miembro ni staff.
  return NextResponse.redirect(`${origin}/acceso-staff?e=nostaff`);
}
