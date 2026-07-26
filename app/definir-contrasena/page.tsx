/**
 * Pantalla donde la persona define su contraseña.
 *
 * Se llega desde el link del mail, que pasa antes por ./confirmar (ahí se canjea
 * el code por sesión). Si alguien entra directo a esta URL sin sesión, el form
 * se muestra igual pero al guardar avisa que el link venció y lo manda a pedir
 * uno nuevo: es mejor que un 404, porque el caso más común es justo ese, alguien
 * que vuelve a abrir un mail viejo.
 */

import type { Metadata } from "next";
import { DefinirContrasenaForm } from "./form";

export const metadata: Metadata = {
  title: "LABURO. | Tu contraseña",
  // Que no lo indexe nadie: es una pantalla de cuenta, no de marketing.
  robots: { index: false, follow: false },
};

export default function DefinirContrasenaPage() {
  return <DefinirContrasenaForm />;
}
