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
    "Productora, agencia, marca, empresa o vos solo: creá tu cuenta gratis, contá qué staff te falta y LABURO te arma el equipo con gente del pool de tu zona.",
  alternates: { canonical: "/registrar-productora" },
  // Sin openGraph propio, el link compartido por WhatsApp salía sin imagen.
  openGraph: {
    type: "website",
    url: "/registrar-productora",
    siteName: "LABURO",
    locale: "es_AR",
    title: "LABURO. | Creá tu cuenta y armá tu evento",
    description: "Productora, agencia, marca, empresa o vos solo: creá tu cuenta gratis, contá qué staff te falta y LABURO te arma el equipo con gente del pool de tu zona.",
    images: [{ url: "/brand/laburo-og.png", width: 1200, height: 630, alt: "LABURO" }],
  },
};

export default function RegistrarProductoraPage() {
  return <RegistroProductoraClient />;
}
