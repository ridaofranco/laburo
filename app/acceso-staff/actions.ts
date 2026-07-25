"use server";

/**
 * Gate del login de staff (Lote 2 de seguridad).
 *
 * El form mandaba el magic link con shouldCreateUser:true directo desde el
 * browser a cualquier email → email-bombing (mandar links a casillas ajenas) +
 * auth.users lleno de cuentas basura. Ahora el envío pasa por acá:
 *  1. Validamos server-side, con service-role, si el email está en el pool
 *     (RPC staff_app_email_in_pool, granteada SOLO a service_role).
 *  2. Solo si está en el pool mandamos el OTP.
 *  3. Devolvemos SIEMPRE la misma respuesta (`{ ok: true }`), esté o no en el
 *     pool: sin oráculo de enumeración, nadie puede averiguar quién es staff.
 */

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/site";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function requestStaffMagicLink(email: string): Promise<{ ok: boolean }> {
  const clean = (email || "").trim().toLowerCase();
  // Respuesta uniforme siempre (no revelamos validez del email ni pertenencia al pool).
  if (!clean || !EMAIL_RE.test(clean)) return { ok: true };

  // FRENO DE ABUSO. Cada pedido válido manda un mail por Supabase Auth, y ese tope
  // es del PROYECTO ENTERO, compartido con PASE: un script pidiendo acceso mil
  // veces deja sin poder entrar a las 699 personas de la tanda de bienvenida.
  // 5 por minuto por IP (una persona real necesita uno, dos si se equivocó) y 20
  // por hora por dirección, para el caso de varias personas en la misma oficina.
  // La respuesta sigue siendo la misma de siempre: al que abusa no se le dice ni
  // que existe un límite, ni si el mail estaba en el pool.
  const ip = await clientIp();
  if (!rateLimit(`staff-link:ip:${ip}`, 5, 60_000).ok) return { ok: true };
  if (!rateLimit(`staff-link:ip-hora:${ip}`, 20, 3_600_000).ok) return { ok: true };
  if (!rateLimit(`staff-link:mail:${clean}`, 3, 600_000).ok) return { ok: true };

  // ¿Está en el pool? (service-role; la RPC no está granteada a anon/authenticated)
  const admin = createServiceRoleClient();
  const { data: inPool, error } = await admin.rpc("staff_app_email_in_pool", {
    p_email: clean,
  });
  if (error || inPool !== true) return { ok: true };

  // Recién acá mandamos el OTP (y recién acá se puede crear la cuenta).
  const origin = SITE_URL;
  const supabase = await createClient();
  await supabase.auth.signInWithOtp({
    email: clean,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      shouldCreateUser: true,
    },
  });
  return { ok: true };
}
