/**
 * /equipo/[token] — la pantalla que abre el invitado desde el mail.
 *
 * ⚠️ NO ACEPTA SOLA AL ABRIR. Un mail se previsualiza, se reenvía y lo escanean
 * los antivirus corporativos: si esta ruta aceptara con solo cargarse, una
 * invitación se consumiría sin que la persona haga nada. Se acepta con un clic
 * explícito, y solo con la sesión de la dirección invitada.
 */

import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { AceptarInvitacion } from "./aceptar-client";

export const metadata: Metadata = {
  title: "LABURO. | Te sumaron a un equipo",
  robots: { index: false, follow: false },
};

export default async function EquipoInvitacionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const [{ data: invitacion }, { data: userData }] = await Promise.all([
    supabase.rpc("staff_app_ver_invitacion_miembro", { p_token: token }),
    supabase.auth.getUser(),
  ]);

  return (
    <AceptarInvitacion
      token={token}
      invitacion={(invitacion as Record<string, unknown> | null) ?? null}
      emailSesion={userData?.user?.email ?? null}
    />
  );
}
