/**
 * /entrar — la puerta única de LABURO.
 *
 * Antes del 5/8 había NUEVE puertas y tres mecanismos: `/login` (productora) y
 * `/acceso-staff` (staff) eran dos pantallas idénticas para dos públicos, y el
 * proveedor no tenía ninguna (dependía de un link que le había llegado por mail
 * y vencía a los 30 días).
 *
 * Franco, textual: *"Yo necesito que ingresar sea facil, me parece que la
 * complicamos un monton"*.
 *
 * Las puertas viejas siguen andando: esta se suma, no reemplaza.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { orgActual } from "@/lib/org";
import { EntrarClient } from "./entrar-client";

export const metadata: Metadata = {
  title: "LABURO. | Entrar",
  description:
    "Entrá a LABURO: armás eventos, trabajás en eventos, prestás un servicio o tenés un salón. Una sola puerta.",
  // Sin canonical, /entrar?motivo=… y /entrar?como=… contaban como páginas distintas (31/10).
  alternates: { canonical: "https://laburo.somosder.ar/entrar" },
};

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Con sesión abierta, "/entrar" a secas volvía a preguntar «¿Qué sos?» (27/10).
  // Se lleva a cada uno a su panel, con las mismas lecturas que el layout del
  // portal. Solo sin parámetros: un link con ?como= o ?next= es alguien que
  // quiere entrar con OTRA cuenta o volver a un lugar puntual.
  const params = await searchParams;
  if (Object.keys(params).length === 0) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      if (await orgActual()) redirect("/dashboard");
      const { data: ficha } = await supabase.rpc("staff_app_my_staff_profile");
      if (ficha) redirect("/panel-staff");
      const { data: proveedor } = await supabase.rpc("staff_app_mi_perfil_proveedor");
      if (proveedor) redirect("/mi-proveedor");
    }
  }
  return <EntrarClient />;
}
