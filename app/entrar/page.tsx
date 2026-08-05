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
import { EntrarClient } from "./entrar-client";

export const metadata: Metadata = {
  title: "LABURO. | Entrar",
  description:
    "Entrá a LABURO como productora, como staff o como proveedor. Una sola puerta.",
};

export default function EntrarPage() {
  return <EntrarClient />;
}
