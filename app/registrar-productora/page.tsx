/**
 * /registrar-productora — el alta abierta de productoras (Fase 2).
 *
 * Hasta hoy una productora que quería usar LABURO dejaba una consulta en la
 * landing y Franco la contactaba a mano. Decisión del 2/8: se anota y opera.
 */

import type { Metadata } from "next";
import { RegistroProductoraClient } from "./registro-client";

export const metadata: Metadata = {
  title: "LABURO. | Creá tu cuenta y armá tu evento",
  description:
    "Productora, agencia, marca, empresa o vos solo: cargá tu evento, publicá qué personal necesitás y recibí a la gente que quiere trabajar. Publicar es gratis.",
};

export default function RegistrarProductoraPage() {
  return <RegistroProductoraClient />;
}
