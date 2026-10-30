import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { orgActual } from "@/lib/org";

/**
 * Quien NO es de ninguna productora y abre una pantalla del portal (un link
 * viejo, el botón de atrás, un favorito) va a SU panel: staff a /panel-staff,
 * proveedor o salón a /mi-proveedor. Si no es ninguno, devuelve true y el
 * layout muestra «Esta cuenta no tiene acceso».
 *
 * Lo usan el layout del portal y las páginas que leen con exigirOrg(): en Next
 * el layout y la página se dibujan EN PARALELO, así que el redirect del layout
 * no llegaba a tiempo y la página tiraba «forbidden» (página de error; Vercel
 * lo vio en /config, /cotizaciones y /proveedores el 28 y 29/10).
 * Solo lecturas: nada de /auth/callback, que provisiona membresías.
 */
export async function sinOrgAlPanel(): Promise<boolean> {
  if (await orgActual()) return false;
  const supabase = await createClient();
  const { data: ficha, error: fichaError } = await supabase.rpc("staff_app_my_staff_profile");
  if (fichaError) console.error("[portal] no se pudo leer my_staff_profile:", fichaError.message);
  if (ficha) redirect("/panel-staff");
  const { data: proveedor, error: proveedorError } = await supabase.rpc("staff_app_mi_perfil_proveedor");
  if (proveedorError) console.error("[portal] no se pudo leer mi_perfil_proveedor:", proveedorError.message);
  if (proveedor) redirect("/mi-proveedor");
  return true;
}
