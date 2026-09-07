/**
 * /soy — los sombreros de una misma persona.
 *
 * ── EL PROBLEMA QUE RESUELVE (Franco, 7/9/2026) ─────────────────────────────
 * Textual: *"acá no estoy viendo eso de que pueda moverse a productora, a
 * servicios, y a proveedor, o empleado, que seleccione... por ahí un pibe
 * independiente le sirve para poder trabajar sus eventos y contratar gente o
 * proveedores y al mismo tiempo quiere ofrecer sus servicios de producción de
 * eventos y deja su CV para que lo contraten... es medio difícil, debería ser
 * sencillo no?"*.
 *
 * ⚠️ Y LO NOTABLE ES QUE EL MODELO YA LO PERMITÍA. No hubo que cambiar la base:
 *  - `marketplace_profiles` acepta `persona`, `proveedor` y `salon`, y NO tiene
 *    restricción de uno por usuario: la misma cuenta puede tener los tres.
 *  - `members` ata la cuenta a una productora, aparte de todo lo anterior.
 *  - `/auth/callback` YA sabe que alguien puede ser varias cosas: chequea las
 *    tres y usa el hint `como` para elegir cuál abrir.
 * Lo que faltaba era la PANTALLA: no existía ningún lugar donde ver los
 * sombreros que tenés, ponerte otro, o sumar el que te falta. Cada alta era una
 * puerta separada que creaba una cosa sola y nada las juntaba.
 *
 * ⚠️ Y NO PIDE VOLVER A ENTRAR. El único "cambiar de perfil" que existía (en
 * /mi-proveedor) mandaba a `/entrar`, o sea a escribir el mail de nuevo teniendo
 * la sesión abierta. Acá, con sesión, se va derecho al panel que corresponde.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { orgActual } from "@/lib/org";
import { SoyClient } from "./soy-client";

export const metadata: Metadata = {
  title: "LABURO. | Mis perfiles",
  robots: { index: false, follow: false },
};

export default async function SoyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/entrar");

  // Las tres preguntas que ya hacía /auth/callback, juntas y sin efectos: acá
  // solo se MIRA qué hay. `staff_app_vincular_proveedor` sí vincula por mail,
  // que es idempotente y es justo lo que queremos (si la persona se anotó como
  // proveedor con este mismo mail, que aparezca).
  const [org, staff, prov] = await Promise.all([
    orgActual(),
    supabase.rpc("staff_app_my_staff_profile"),
    supabase.rpc("staff_app_vincular_proveedor"),
  ]);

  return (
    <SoyClient
      email={user.email ?? ""}
      productora={org ? { nombre: org.nombre ?? "Tu productora", rol: org.rol ?? null } : null}
      esStaff={!!staff.data}
      esProveedor={!!(prov.data as { ok?: boolean } | null)?.ok}
    />
  );
}
