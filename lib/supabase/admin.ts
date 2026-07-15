/**
 * Service-role Supabase client.
 *
 * Sólo para usar en endpoints SERVER-SIDE que reciben webhooks de terceros
 * (no llegan con sesión de usuario, no podés depender de RLS via auth).
 *
 * Bypassa RLS — extremo cuidado al usarlo. Validar siempre el origen del
 * request antes de leer/escribir cualquier cosa.
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY en env (NUNCA exponer al cliente).
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (o NEXT_PUBLIC_SUPABASE_URL) no está seteado. " +
        "Este cliente sólo se usa server-side y requiere la service-role key.",
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
