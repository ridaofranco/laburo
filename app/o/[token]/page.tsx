/**
 * Página pública de la oferta por link mágico (ACPT-01/02/03), server component.
 *
 * Vive a NIVEL RAÍZ (fuera del grupo (app)) a propósito: el layout de (app) hace
 * el gate de membresía y redirigiría al candidato sin cuenta a /login (Pitfall 5).
 * `/o` está en publicPaths del middleware para que la ruta no se intercepte.
 *
 * GET seguro (D-02): llama al wrapper public.staff_app_get_public_offer con el
 * cliente server (anon; en esta ruta no hay sesión, y está bien porque la RPC es
 * por token). El wrapper reenvía a la RPC SECURITY DEFINER de Fase 1, que además
 * flipea sent->viewed en el primer hit (efecto lateral aceptable en un GET).
 * `force-dynamic` garantiza que ese flip corra en cada request (Pitfall 4).
 *
 * Deriva el estado en el servidor (deriveView) y muestra una de 5 vistas. Sólo
 * "activa" monta el <form> Aceptar/Rechazar (POST). Aceptar/rechazar NUNCA es un
 * GET: los bots de preview de email/WhatsApp no pueden disparar la aceptación.
 *
 * PII-safe (Pitfall 7): renderiza SÓLO lo que devuelve get_public_offer
 * (first_name + oferta/gig/org). Sin segunda query, sin email/tel/cv. No usa el
 * cliente service-role ni llama al schema staff_app directo (siempre el wrapper).
 */

import { createClient } from "@/lib/supabase/server";
import { fmtFechaHora } from "@/lib/dates";
import { AcceptDecline } from "./accept-decline";
import { WhatsAppCta, PortalStaffLink } from "./wa-cta";
import {
  deriveView,
  TERMINAL_COPY,
  type PublicOffer,
  type TerminalView,
} from "./offer-state";
import { LaburoWordmark } from "@/components/laburo-wordmark";

// El flip sent->viewed debe correr por request; nunca servir un RSC cacheado.
export const dynamic = "force-dynamic";

/** Fecha legible es-AR (hora AR, no la del server UTC). null si vacía/inválida. */
function fmtDate(iso: string | null): string | null {
  return fmtFechaHora(iso, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Rango de fechas del gig: "inicio → fin" si hay ambas, sólo inicio si no. */
function fmtWhen(startsAt: string | null, endsAt: string | null): string | null {
  const start = fmtDate(startsAt);
  const end = fmtDate(endsAt);
  if (start && end) return `${start} a ${end}`;
  return start ?? end;
}

/** Monto en pesos, formateado es-AR. null si no viene → se omite la fila. */
function fmtAmount(amount: number | null): string | null {
  if (amount == null || Number.isNaN(amount)) return null;
  return `$${amount.toLocaleString("es-AR")}`;
}

/** Contenedor de la página pública. El root layout ya da html/body/fonts/Toaster;
 *  esta ruta NO hereda el <main> centrado de (app), así que trae el suyo. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-surface-0">
      <header className="px-md py-md pt-[max(var(--spacing-md),env(safe-area-inset-top))]">
        <LaburoWordmark className="h-[24px] w-auto" />
      </header>
      <main className="flex-1 w-full max-w-[440px] mx-auto px-md pb-[max(var(--spacing-2xl),env(safe-area-inset-bottom))]">
        {children}
      </main>
    </div>
  );
}

/** Fila etiqueta/valor de la tarjeta de oferta; se omite si el valor está vacío. */
function OfferRow({ label, value }: { label: string; value: string | null | undefined }) {
  const v = (value ?? "").trim();
  if (!v) return null;
  return (
    <div className="flex flex-col gap-xs">
      <span className="text-label font-semibold text-fg-muted">{label}</span>
      <span className="text-body text-fg whitespace-pre-line">{v}</span>
    </div>
  );
}

/** Pantalla de estado terminal (aceptada/rechazada/vencida/inválida): sin form,
 *  pero con un camino real (fix UX 28/7): botón wa.me con mensaje precargado por
 *  caso, y el portal de staff si ya confirmó. */
function TerminalScreen({ view }: { view: TerminalView }) {
  const c = TERMINAL_COPY[view];
  return (
    <div className="flex flex-col gap-md rounded-none bg-surface-1 border border-border p-lg mt-xl">
      <h1 className="font-display text-[32px] text-fg">{c.title}</h1>
      <p className="text-body text-fg-muted">{c.body}</p>
      <WhatsAppCta label={c.wa.label} mensaje={c.wa.mensaje} />
      {c.portal && <PortalStaffLink />}
    </div>
  );
}

export default async function OfferPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc("staff_app_get_public_offer", {
    p_token: token,
  });

  // deriveView (offer-state.ts, compartido con offer-actions) decide la vista:
  // 'accepted'/'declined' por status, y "vencida" SIEMPRE por now() > offer.expires_at
  // (el status nunca se auto-flipea a 'expired', no hay cron — Pitfall 2). data null
  // (token malo) → "invalida". Sólo "activa" monta el form.
  const view = deriveView(data);

  // 4 de las 5 vistas son terminales: mensaje cálido, sin form (D-03).
  if (view !== "activa") {
    return (
      <Shell>
        <TerminalScreen view={view} />
      </Shell>
    );
  }

  // Vista "activa": render de la oferta + <form> Aceptar/Rechazar.
  const d = data as PublicOffer;
  const firstName = (d.applicant?.first_name ?? "").trim();
  const orgName = (d.org?.name ?? "").trim();
  const when = fmtWhen(d.gig?.starts_at ?? null, d.gig?.ends_at ?? null);
  const amount = fmtAmount(d.offer?.amount ?? null);

  return (
    <Shell>
      <div className="flex flex-col gap-lg pt-md">
        {/* Saludo cálido con el primer nombre del candidato */}
        <header className="flex flex-col gap-xs">
          <h1 className="font-display text-[32px] text-fg">
            {firstName ? `Hola ${firstName}` : "Hola"}
          </h1>
          <p className="text-body text-fg-muted">
            {orgName
              ? `Tenés una propuesta de laburo de ${orgName}.`
              : "Tenés una propuesta de laburo."}
          </p>
        </header>

        {/* Tarjeta de la oferta: filas vacías omitidas (null-safety) */}
        <div className="flex flex-col gap-md rounded-2xl bg-surface-1 border border-border p-lg">
          <OfferRow label="Rol" value={d.offer?.role} />
          <OfferRow label="Evento" value={d.gig?.title} />
          <OfferRow label="Cuándo" value={when} />
          <OfferRow label="Lugar" value={d.gig?.venue} />
          <OfferRow label="Pago" value={amount} />
          <OfferRow label="Condiciones" value={d.offer?.conditions} />
        </div>

        {/* Aceptar/Rechazar por POST (Server Action). Sólo la vista activa lo monta. */}
        <AcceptDecline token={token} gigTitle={d.gig?.title ?? null} />

        <p className="text-label text-fg-subtle text-center">
          Al aceptar quedás confirmado/a para este laburo.
        </p>
      </div>
    </Shell>
  );
}
