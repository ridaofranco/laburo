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
 * (preferencia global, usada con moderación en mobile — D-05). Ante {ok:false,
 * view} cambia a la pantalla del estado real (aceptada/rechazada/vencida/
 * invalida) con el MISMO copy de page.tsx (TERMINAL_COPY), nunca un error crudo
 * (D-03). Voseo, sin em dash, targets 48px.
 */

import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { acceptOffer, declineOffer } from "./offer-actions";
import { TERMINAL_COPY, type TerminalView } from "./offer-state";

type Screen =
  | { kind: "form" }
  | { kind: "done"; title: string; body: string }
  | { kind: "terminal"; view: TerminalView };

/** Tarjeta de resultado con micro-entrada motion (fade + leve subida). */
function ResultCard({ title, body }: { title: string; body: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="flex flex-col gap-md rounded-none bg-surface-1 border border-border p-lg"
    >
      <h2 className="font-display text-[28px] text-fg">{title}</h2>
      <p className="text-body text-fg-muted">{body}</p>
    </motion.div>
  );
}

export function AcceptDecline({ token }: { token: string }) {
  const [screen, setScreen] = useState<Screen>({ kind: "form" });
  const [pending, startTransition] = useTransition();

  function run(
    action: (t: string) => Promise<{ ok: true } | { ok: false; view: TerminalView }>,
    success: { title: string; body: string },
  ) {
    if (pending) return; // no re-entrar mientras hay una acción en vuelo
    startTransition(async () => {
      try {
        const res = await action(token);
        if (res.ok) {
          setScreen({ kind: "done", ...success });
        } else {
          setScreen({ kind: "terminal", view: res.view });
        }
      } catch {
        toast.error("Algo falló. Probá de nuevo en un momento.");
      }
    });
  }

  if (screen.kind === "done") {
    return <ResultCard title={screen.title} body={screen.body} />;
  }

  if (screen.kind === "terminal") {
    const c = TERMINAL_COPY[screen.view];
    return <ResultCard title={c.title} body={c.body} />;
  }

  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="flex flex-col gap-sm"
    >
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(acceptOffer, {
            title: "Listo, confirmaste la propuesta",
            body: "Nos vemos ahí. Si tenés alguna duda, escribinos por WhatsApp.",
          })
        }
        className="flex items-center justify-center gap-xs min-h-[48px] rounded-none bg-fg text-surface-0 border border-fg label-tech text-[13px] px-md transition-colors hover:bg-transparent hover:text-fg disabled:opacity-60 disabled:pointer-events-none"
      >
        {pending ? "Un momento…" : "Aceptar"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(declineOffer, {
            title: "Rechazaste la propuesta",
            body: "Gracias por avisar. Si cambiás de idea, escribinos por WhatsApp.",
          })
        }
        className="flex items-center justify-center gap-xs min-h-[48px] rounded-xl bg-surface-2 border border-border text-fg text-label font-semibold px-md transition-transform active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
      >
        Rechazar
      </button>
    </form>
  );
}
