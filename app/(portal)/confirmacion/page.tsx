/**
 * Confirmación de envío de oferta (lado PRODUCTOR), server component. Lee el
 * resumen REAL de los query params (?staff, ?rol, ?evento) y se lo pasa a la
 * vista con animaciones. Sin params → confirmación genérica honesta (nada de
 * nombres inventados; antes decía "Elena Rostova / Art Basel '24"). Nota: el
 * flujo real de envío ya muestra el éxito inline en el offer-form; esta pantalla
 * queda como confirmación standalone reutilizable.
 */

import { ConfirmacionView, type ResumenCell } from "./confirmacion-view";

export default async function ConfirmacionPage({
  searchParams,
}: {
  searchParams: Promise<{ staff?: string; rol?: string; evento?: string }>;
}) {
  const sp = await searchParams;
  const resumen: ResumenCell[] = [];
  const staff = (sp.staff ?? "").trim();
  const rol = (sp.rol ?? "").trim();
  const evento = (sp.evento ?? "").trim();
  if (staff) resumen.push({ label: "Staff", value: staff });
  if (rol) resumen.push({ label: "Rol", value: rol });
  if (evento) resumen.push({ label: "Evento", value: evento });

  return <ConfirmacionView resumen={resumen} />;
}
