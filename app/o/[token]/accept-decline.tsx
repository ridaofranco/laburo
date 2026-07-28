"use client";

/**
 * Form Aceptar / Rechazar de la oferta (ACPT-02/03), client component.
 *
 * Dos botones dentro de un <form>; cada uno invoca un Server Action POST
 * (acceptOffer/declineOffer) — Next 15 lo manda por POST, nunca GET, así que los
 * bots de preview no pueden disparar la aceptación (D-02). Ambos botones se
 * deshabilitan mientras hay una acción en vuelo (useTransition): buena UX contra
 * el doble-tap, aunque el backend ya es idempotente (ON CONFLICT DO NOTHING).
 *
 * En éxito muestra una confirmación cálida con una micro-interacción motion
 * (preferencia global, usada con moderación en mobile — D-05) y un camino real
 * a seguir (fix UX 28/7): botón wa.me con mensaje precargado según el caso
 * (aceptó: coordinar detalles; rechazó: avisar) y, si aceptó, el link al portal
 * de staff. Una acción principal, un canal, cero "escribinos" sin link. Ante
 * {ok:false, view} cambia a la pantalla del estado real (aceptada/rechazada/
 * vencida/invalida) con el MISMO copy de page.tsx (TERMINAL_COPY), nunca un
 * error crudo (D-03). Voseo, sin em dash, targets 48px.
 */

import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { acceptOffer, declineOffer } from "./offer-actions";
import { TERMINAL_COPY, type TerminalView } from "./offer-state";
import { WhatsAppCta, PortalStaffLink } from "./wa-cta";

type DoneResult = "aceptada" | "rechazada";

type Screen =
  | { kind: "form" }
  | { kind: "done"; result: DoneResult }
  | { kind: "terminal"; view: TerminalView };

/** Copy del éxito recién resuelto (distinto del terminal "ya lo hiciste antes"). */
const DONE_COPY: Record<DoneResult, { title: string; body: string; waLabel: string }> = {
  aceptada: {
    title: "Listo, confirmaste la propuesta",
    body: "Quedás confirmado/a para este laburo. Nos vemos ahí.",
    waLabel: "Coordinar por WhatsApp",
  },
  rechazada: {
    title: "Rechazaste la propuesta",
    body: "Gracias por avisar. Si cambiás de idea, todavía estás a tiempo.",
    waLabel: "Avisar por WhatsApp",
  },
};

/** Mensaje precargado del wa.me, con el evento si lo tenemos para dar contexto. */
function waMensaje(result: DoneResult, gigTitle: string | null): string {
  const por = gigTitle ? ` para ${gigTitle}` : " de LABURO";
  return result === "aceptada"
    ? `Hola, acabo de confirmar la propuesta${por} y quiero coordinar los detalles.`
    : `Hola, te escribo por la propuesta${por} que acabo de rechazar.`;
}

/** Tarjeta de resultado con micro-entrada motion (fade + leve subida). */
function ResultCard({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="flex flex-col gap-md rounded-none bg-surface-1 border border-border p-lg"
    >
      <h2 className="font-display text-[28px] text-fg">{title}</h2>
      <p className="text-body text-fg-muted">{body}</p>
      {children}
    </motion.div>
  );
}

export function AcceptDecline({
  token,
  gigTitle = null,
}: {
  token: string;
  gigTitle?: string | null;
}) {
  const [screen, setScreen] = useState<Screen>({ kind: "form" });
  const [pending, startTransition] = useTransition();

  function run(
    action: (t: string) => Promise<{ ok: true } | { ok: false; view: TerminalView }>,
    result: DoneResult,
  ) {
    if (pending) return; // no re-entrar mientras hay una acción en vuelo
    startTransition(async () => {
      try {
        const res = await action(token);
        if (res.ok) {
          setScreen({ kind: "done", result });
        } else {
          setScreen({ kind: "terminal", view: res.view });
        }
      } catch {
        toast.error("Algo falló. Probá de nuevo en un momento.");
      }
    });
  }

  if (screen.kind === "done") {
    const c = DONE_COPY[screen.result];
    return (
      <ResultCard title={c.title} body={c.body}>
        <WhatsAppCta label={c.waLabel} mensaje={waMensaje(screen.result, gigTitle)} />
        {screen.result === "aceptada" && <PortalStaffLink />}
      </ResultCard>
    );
  }

  if (screen.kind === "terminal") {
    const c = TERMINAL_COPY[screen.view];
    return (
      <ResultCard title={c.title} body={c.body}>
        <WhatsAppCta label={c.wa.label} mensaje={c.wa.mensaje} />
        {c.portal && <PortalStaffLink />}
      </ResultCard>
    );
  }

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="flex flex-col gap-sm"
    >
      <button
        type="button"
        disabled={pending}
        onClick={() => run(acceptOffer, "aceptada")}
        className="flex items-center justify-center gap-xs min-h-[48px] rounded-none bg-fg text-surface-0 border border-fg label-tech text-[13px] px-md transition-colors hover:bg-transparent hover:text-fg disabled:opacity-60 disabled:pointer-events-none"
      >
        {pending ? "Un momento…" : "Aceptar"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(declineOffer, "rechazada")}
        className="flex items-center justify-center gap-xs min-h-[48px] rounded-xl bg-surface-2 border border-border text-fg text-label font-semibold px-md transition-transform active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
      >
        Rechazar
      </button>
    </form>
  );
}
