"use client";

/**
 * Botón "Avisar pago listo" de cada fila de /pagos.
 *
 * Un click = un mail "Tu pago está listo" a la persona (exactly-once: la RPC
 * solo estampa si no se avisó antes, así que el doble click no manda dos).
 * Estados honestos con toast: mandado, ya estaba avisado, mail falló (el pago
 * queda marcado igual y se avisa por WhatsApp), o falta la migración 0032.
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { avisarPagoListo } from "./pago-actions";

export function PagoListoBoton({
  offerId,
  yaAvisado,
}: {
  offerId: string;
  /** offers.pago_listo_at ya estampado (vino de la vista). */
  yaAvisado: boolean;
}) {
  const [pending, startTransition] = useTransition();
  // Optimista local: tras avisar, el botón pasa a "Avisado" sin refetch.
  const [avisado, setAvisado] = useState(yaAvisado);

  if (avisado) {
    return (
      <span className="label-tech text-[11px] text-[#3dd68c] whitespace-nowrap">
        Pago avisado
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            const r = await avisarPagoListo(offerId);
            if (!r.ok) {
              toast.error(r.reason);
              return;
            }
            setAvisado(true);
            if (r.already) {
              toast.info("Ya se le había avisado: no se mandó de nuevo.");
            } else if (r.mail.ok) {
              toast.success("Aviso de pago mandado.");
            } else {
              toast.warning(
                "El pago quedó marcado, pero el mail no salió. Avisale por WhatsApp.",
              );
            }
          } catch {
            toast.error("No se pudo avisar. Probá de nuevo.");
          }
        })
      }
      className="label-tech text-[11px] text-[#e5e2e1] border border-[#4c4546] px-3 py-2 hover:border-[#e5e2e1] transition-colors disabled:opacity-50 whitespace-nowrap"
    >
      {pending ? "Mandando..." : "Avisar pago listo"}
    </button>
  );
}
