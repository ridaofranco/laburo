/**
 * /registrar-salon — la puerta de entrada del salón (cuarto pool, 6/8).
 *
 * Antes de esto un salón solo podía publicarse como proveedor con el rubro
 * "Salones y espacios", o sea sin el único filtro con el que se lo busca: cuánta
 * gente entra. Aparecía en el directorio y no lo encontraba nadie.
 *
 * Decisión de Franco (3/8, que vale igual para este pool): *"no voy a cargar
 * proveedores, tiene que estar listo para que se carguen solos"*.
 */

import type { Metadata } from "next";
import { RegistroSalonClient } from "./registro-client";

export const metadata: Metadata = {
  title: "LABURO. | Publicá tu salón para eventos",
  description:
    "Publicá tu salón y te encuentran los que buscan dónde hacer su fiesta: por cuánta gente entra y por dónde queda. Estar en el directorio es gratis.",
};

export default function RegistrarSalonPage() {
  return <RegistroSalonClient />;
}
