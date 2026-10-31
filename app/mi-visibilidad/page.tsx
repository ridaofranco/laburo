/**
 * "¿Querés que otras productoras te vean?" — la pregunta de consentimiento.
 *
 * Sin cuenta y sin sesión: el gate es el token HMAC del link, igual que /baja.
 * Sin token válido no se muestra ningún dato ni se confirma si la ficha existe.
 *
 * ⚠️ Las dos respuestas pesan lo mismo en la pantalla. Un "sí" grande y un "no"
 * chiquito en gris convierte una pregunta en un embudo, y entonces la respuesta
 * no sirve como consentimiento: sirve como estadística de diseño.
 */

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { visibilidadReady, visibilidadToken, visibilidadTokenOk } from "@/lib/visibilidad";
import { getMyStaffProfile } from "@/lib/staff";
import { VisibilidadClient } from "./visibilidad-client";

export const metadata: Metadata = {
  title: "LABURO. | Tu perfil",
  robots: { index: false, follow: false },
};

export default async function MiVisibilidadPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; t?: string }>;
}) {
  const { id, t } = await searchParams;

  // CON SESIÓN DE STAFF (29/10): sin link, o con uno que no sirve, la persona
  // logueada elige sobre SU ficha. Así puede cambiar de opinión desde «Mi
  // perfil» aunque haya perdido el mail. El token se firma acá, del lado del
  // servidor, solo para el id de la sesión: no abre la ficha de nadie más.
  if (!id || !t || !visibilidadTokenOk(id, t)) {
    const propia = visibilidadReady() ? await getMyStaffProfile().catch(() => null) : null;
    if (propia?.id && propia.id !== id) {
      redirect(`/mi-visibilidad?id=${encodeURIComponent(propia.id)}&t=${visibilidadToken(propia.id)}`);
    }
  }

  if (!id || !t || !visibilidadTokenOk(id, t)) {
    return (
      <main className="min-h-dvh bg-[#131313] text-[#e5e2e1] flex flex-col items-center justify-center px-6 gap-4 text-center">
        <h1 className="t-section">Este link no es válido</h1>
        <p className="text-[16px] text-[#cfc4c5] max-w-[440px] leading-[1.6]">
          Puede que esté incompleto. Probá abrirlo de nuevo desde el mail, o
          escribinos y lo resolvemos.
        </p>
      </main>
    );
  }

  // Solo el nombre y la respuesta anterior. Nada más: es una pantalla pública.
  const admin = createServiceRoleClient();
  const { data } = await admin
    .schema("staff_app")
    .from("staff_profiles")
    .select("nombre, visible_para_red")
    .eq("id", id)
    .maybeSingle();

  const fila = data as { nombre?: string | null; visible_para_red?: boolean | null } | null;

  return (
    <VisibilidadClient
      profileId={id}
      token={t}
      nombre={fila?.nombre ?? null}
      yaRespondio={fila?.visible_para_red ?? null}
    />
  );
}
