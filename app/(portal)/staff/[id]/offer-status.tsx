/**
 * Reflejo de estado de ofertas (STAT-01, D-06), server component.
 *
 * Renderiza, en el perfil del candidato, el estado de cada oferta que Franco le
 * mandó: enviada / vista / aceptada / rechazada / vencida. Las filas ya vienen
 * cargadas por el RSC de perfil desde public.staff_app_offers (vista
 * security_invoker, RLS is_org_member scopea al org del caller).
 *
 * REGLA CLAVE (Pitfall 2 del research): "Vencida" es DERIVADA de
 * now() > expires_at. El enum status NUNCA se auto-flipea al valor 'expired' (no
 * hay cron), así que jamás confiamos en ese valor del enum; lo calculamos en el
 * render, mismo criterio que la página pública /o/[token].
 *
 * Sin PII de terceros: la vista ya viene scopeada y sólo trae rol + título del
 * gig + timestamps de la propia oferta. Copy en voseo, sin em dash.
 */

import { fmtFecha } from "@/lib/dates";

export interface OfferRow {
  id: string;
  role: string | null;
  gig_title: string | null;
  status: string | null;
  expires_at: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  responded_at: string | null;
}

/**
 * Etiqueta visible derivada del estado de la oferta. MISMO orden que la página
 * pública (D-06): accepted → "Aceptada", declined → "Rechazada",
 * now() > expires_at → "Vencida" (DERIVADO, nunca del valor 'expired' del enum),
 * viewed → "Vista", si no "Enviada".
 */
export function offerLabel(o: { status: string | null; expires_at: string | null }): string {
  if (o.status === "accepted") return "Aceptada";
  if (o.status === "declined") return "Rechazada";
  if (o.expires_at && new Date(o.expires_at).getTime() <= Date.now()) return "Vencida";
  if (o.status === "viewed") return "Vista";
  return "Enviada";
}

/** Clases del badge por etiqueta: verde aceptada, ámbar vencida, apagado rechazada, gris enviada/vista. */
function badgeClass(label: string): string {
  switch (label) {
    case "Aceptada":
      return "bg-positive/15 text-positive";
    case "Vencida":
      return "bg-[#f5a623]/15 text-[#f5a623]";
    case "Rechazada":
      return "bg-surface-2 text-fg-subtle";
    case "Vista":
      return "bg-surface-2 text-fg";
    default: // Enviada
      return "bg-surface-2 text-fg-muted";
  }
}

/** Fecha corta legible (es-AR) para el pie de cada fila. null si vacía/inválida. */
function shortDate(iso: string | null): string | null {
  return fmtFecha(iso);
}

/** Pie de la fila: refleja el último hito conocido de la oferta. */
function offerSubline(o: OfferRow, label: string): string | null {
  if (label === "Aceptada" || label === "Rechazada") {
    const when = shortDate(o.responded_at);
    return when ? `Respondió el ${when}` : null;
  }
  if (label === "Vencida") {
    const when = shortDate(o.expires_at);
    return when ? `Venció el ${when}` : null;
  }
  const when = shortDate(o.sent_at);
  return when ? `Enviada el ${when}` : null;
}

export function OfferStatusList({ offers }: { offers: OfferRow[] }) {
  if (!offers.length) return null;

  return (
    <ul className="flex flex-col gap-sm">
      {offers.map((o) => {
        const label = offerLabel(o);
        const titulo = (o.gig_title ?? "").trim() || "Gig sin título";
        const rol = (o.role ?? "").trim();
        const subline = offerSubline(o, label);
        return (
          <li
            key={o.id}
            className="flex items-start justify-between gap-sm rounded-xl bg-surface-1 border border-border px-md py-sm"
          >
            <div className="flex min-w-0 flex-col gap-xs">
              <span className="text-body font-semibold text-fg truncate">{titulo}</span>
              {rol && <span className="text-label text-fg-muted truncate">{rol}</span>}
              {subline && <span className="text-label text-fg-subtle">{subline}</span>}
            </div>
            <span
              className={`shrink-0 rounded-none text-label font-semibold px-sm py-xs ${badgeClass(label)}`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
