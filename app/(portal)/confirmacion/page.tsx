/**
 * Confirmación de envío de oferta (lado PRODUCTOR), server component. Lee el
 * resumen REAL de los query params (?staff, ?rol, ?evento) y se lo pasa a la
 * vista con animaciones. Sin params → confirmación genérica honesta (nada de
 * nombres inventados; antes decía "Elena Rostova / Art Basel '24"). Nota: el
 * flujo real de envío ya muestra el éxito inline en el offer-form; esta pantalla
 * queda como confirmación standalone reutilizable.
 */

import { ConfirmacionView, type ResumenCell } from "./confirmacion-view";

type Param = string | string[] | undefined;

/** Un query param puede venir repetido (string[]): tomamos el primero. Sin esto
 * `.trim()` sobre un array tira 500. */
function one(v: Param): string {
  return (Array.isArray(v) ? v[0] ?? "" : v ?? "").trim();
}

export default async function ConfirmacionPage({
  searchParams,
}: {
  searchParams: Promise<{ staff?: Param; rol?: Param; evento?: Param }>;
}) {
  const sp = await searchParams;
  const resumen: ResumenCell[] = [];
  const staff = one(sp.staff);
  const rol = one(sp.rol);
  const evento = one(sp.evento);
  if (staff) resumen.push({ label: "Staff", value: staff });
  if (rol) resumen.push({ label: "Rol", value: rol });
  if (evento) resumen.push({ label: "Evento", value: evento });

  return <ConfirmacionView resumen={resumen} />;
}
