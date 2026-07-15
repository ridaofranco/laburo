import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Callback de OAuth / magic link.
 *
 * Después de canjear el code por sesión, llama al RPC SECURITY DEFINER
 * public.staff_app_provision_member() con el cliente autenticado normal:
 * la allowlist D-06 vive DENTRO de la función (contra auth.email()), así que
 * un login no autorizado recibe NULL y ninguna fila de members (el gate lo
 * deniega). NO intentar acceder al schema staff_app via PostgREST: no está
 * expuesto y cualquier llamada falla con PGRST106 (probado en 01-03).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  // Solo destinos internos (evita open-redirect).
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Provisioning idempotente de la membresía (fallback del seed de 02-01).
      // Si el email no está en la allowlist, devuelve NULL sin error.
      await supabase.rpc("staff_app_provision_member");

      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  // Error de auth: volver al login.
  return NextResponse.redirect(`${origin}/login`);
}
