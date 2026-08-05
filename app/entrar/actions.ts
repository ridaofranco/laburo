"use server";

/**
 * Lo único que la puerta necesita del servidor: si un mail corresponde a un
 * proveedor que ya existe.
 *
 * ── POR QUÉ HACE FALTA ──────────────────────────────────────────────────────
 * Los proveedores que se anotaron antes del 5/8 NO tienen usuario en `auth`:
 * el diseño original era sin cuenta, solo link mágico. Si la puerta les manda un
 * magic link con `shouldCreateUser: false` (que es lo correcto para productoras
 * y staff), Supabase no crea nada, no manda nada, y la persona se queda mirando
 * un "te mandamos un mail" que nunca llega. Es exactamente el callejón sin
 * salida que Franco vino a arreglar.
 *
 * Entonces: si el mail ES de un proveedor cargado, se permite crear el usuario
 * de auth en ese primer ingreso. El vínculo cuenta ↔ perfil lo hace después
 * `staff_app_vincular_proveedor` en /auth/callback.
 *
 * ── POR QUÉ PASA POR ACÁ Y NO POR EL BROWSER ────────────────────────────────
 * `staff_app_email_es_proveedor` está granteada SOLO a service_role, y su propio
 * comentario explica por qué: si fuera alcanzable desde el navegador sería un
 * oráculo de "este mail es proveedor" y se podría enumerar el directorio con una
 * lista de mails. Acá se la llama con la clave de servicio y **no se le devuelve
 * la respuesta cruda a la pantalla**: la pantalla siempre muestra el mismo
 * mensaje, exista o no la cuenta.
 */

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Devuelve si conviene permitir que el magic link cree el usuario de auth.
 * Nunca tira: ante la duda devuelve false, que es el comportamiento de siempre.
 */
export async function proveedorPuedeCrearCuenta(email: string): Promise<boolean> {
  const clean = (email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(clean)) return false;

  // Freno: sin esto esto sí sería un oráculo, uno por request.
  const ip = await clientIp();
  if (!rateLimit(`prv-existe:ip:${ip}`, 12, 60_000).ok) return false;

  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin.rpc("staff_app_email_es_proveedor", {
      p_email: clean,
    });
    if (error) {
      console.error("[entrar] no se pudo chequear si es proveedor:", error.message);
      return false;
    }
    return data === true;
  } catch (e) {
    console.error("[entrar] chequeo de proveedor falló:", e instanceof Error ? e.message : String(e));
    return false;
  }
}
