/**
 * /registrar-productora — el alta abierta de productoras (Fase 2).
 *
 * Hasta hoy una productora que quería usar LABURO dejaba una consulta en la
 * landing y Franco la contactaba a mano. Decisión del 2/8: se anota y opera.
 */

import type { Metadata } from "next";
import { RegistroProductoraClient } from "./registro-client";

export const metadata: Metadata = {
  title: "LABURO. | Creá la cuenta de tu productora",
  description:
    "Cargá tus eventos, publicá qué personal necesitás y recibí a la gente que quiere trabajar. Publicar es gratis.",
};

export default function RegistrarProductoraPage() {
  return <RegistroProductoraClient />;
}
