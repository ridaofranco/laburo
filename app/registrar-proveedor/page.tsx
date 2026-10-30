/**
 * /registrar-proveedor — la puerta de entrada del proveedor.
 *
 * Antes de esto no existía ninguna: el único generador de tokens era
 * staff_app_generar_link_proveedor, que exige ser writer de una productora, y
 * ningún archivo del repo la llamaba. O sea que un proveedor no podía empezar,
 * ni solo ni a mano.
 *
 * Decisión de Franco (3/8): "No voy a cargar proveedores, tiene que estar listo
 * para que proveedores se carguen solos".
 */

import type { Metadata } from "next";
import { RegistroProveedorClient } from "./registro-client";

export const metadata: Metadata = {
  title: "LABURO. | Publicá tus servicios para eventos",
  description:
    "Publicá lo que hacés y dónde trabajás, y las productoras te encuentran cuando arman un evento. Estar en el directorio es gratis.",
  alternates: { canonical: "/registrar-proveedor" },
  // Sin openGraph propio, el link compartido por WhatsApp salía sin imagen.
  openGraph: {
    type: "website",
    url: "/registrar-proveedor",
    siteName: "LABURO",
    locale: "es_AR",
    title: "LABURO. | Publicá tus servicios para eventos",
    description: "Publicá lo que hacés y dónde trabajás, y las productoras te encuentran cuando arman un evento. Estar en el directorio es gratis.",
    images: [{ url: "/brand/laburo-og.png", width: 1200, height: 630, alt: "LABURO" }],
  },
};

export default function RegistrarProveedorPage() {
  return <RegistroProveedorClient />;
}
