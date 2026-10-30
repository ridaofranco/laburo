/**
 * Etiqueta canónica del estado de una oferta, fuente única de verdad para el
 * productor y el staff. "Vencida" es DERIVADA (now > expires_at): el enum status
 * nunca se auto-flipea a 'expired' (no hay cron), así que se calcula en el render.
 *
 * Antes esta función estaba duplicada en lib/staff.ts y en offer-status.tsx (con
 * imports divididos: panel-staff la tomaba de una, gig-board de la otra). Acá se
 * unifica para que no drifteen.
 */
export function offerLabel(o: {
  status: string | null;
  expires_at: string | null;
  gig_starts_at?: string | null;
  gig_ends_at?: string | null;
}): string {
  if (o.status === "accepted") return "Aceptada";
  if (o.status === "declined") return "Rechazada";
  if (o.expires_at && new Date(o.expires_at).getTime() <= Date.now()) return "Vencida";
  if (eventoTerminado(o.gig_starts_at, o.gig_ends_at)) return "Vencida";
  if (o.status === "viewed") return "Vista";
  return "Enviada";
}

/**
 * ¿El evento ya terminó? Fin cargado, o inicio + 12 h si no hay fin; sin fechas,
 * no. Misma regla que la base (0099): una oferta de un evento terminado no se
 * puede aceptar aunque su link todavía no haya vencido (vence a los 7 días).
 */
export function eventoTerminado(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
): boolean {
  const fin = endsAt
    ? new Date(endsAt).getTime()
    : startsAt
      ? new Date(startsAt).getTime() + 12 * 3600 * 1000
      : NaN;
  return Number.isFinite(fin) && fin < Date.now();
}
