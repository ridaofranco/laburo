/**
 * Etiqueta canónica del estado de una oferta, fuente única de verdad para el
 * productor y el staff. "Vencida" es DERIVADA (now > expires_at): el enum status
 * nunca se auto-flipea a 'expired' (no hay cron), así que se calcula en el render.
 *
 * Antes esta función estaba duplicada en lib/staff.ts y en offer-status.tsx (con
 * imports divididos: panel-staff la tomaba de una, gig-board de la otra). Acá se
 * unifica para que no drifteen.
 */
export function offerLabel(o: { status: string | null; expires_at: string | null }): string {
  if (o.status === "accepted") return "Aceptada";
  if (o.status === "declined") return "Rechazada";
  if (o.expires_at && new Date(o.expires_at).getTime() <= Date.now()) return "Vencida";
  if (o.status === "viewed") return "Vista";
  return "Enviada";
}
