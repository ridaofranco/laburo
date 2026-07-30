"use client";

/**
 * Estado de cada lead en /leads: "Marcar contactado" / "Volver a nuevo" +
 * "Descartar". Tres estados, dos clicks, nada más: esto no es un CRM.
 *
 * Optimista local (el estado cambia sin esperar el refetch) y honesto en el
 * error: si la migración 0039 todavía no está aplicada, el toast lo dice tal
 * cual y el estado vuelve para atrás.
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { marcarLeadEstado, type LeadEstado } from "./lead-actions";

const BTN =
  "label-tech text-[11px] px-3 py-2 border transition-colors disabled:opacity-50 whitespace-nowrap";

export function LeadEstadoBoton({
  leadId,
  estado: estadoInicial,
}: {
  leadId: string;
  estado: LeadEstado;
}) {
  const [pending, startTransition] = useTransition();
  const [estado, setEstado] = useState<LeadEstado>(estadoInicial);

  const mover = (proximo: LeadEstado) =>
    startTransition(async () => {
      const previo = estado;
      setEstado(proximo);
      try {
        const r = await marcarLeadEstado(leadId, proximo);
        if (!r.ok) {
          setEstado(previo);
          toast.error(r.reason);
          return;
        }
        toast.success(
          proximo === "contactado"
            ? "Marcado como contactado."
            : proximo === "descartado"
              ? "Lead descartado."
              : "Volvió a quedar como nuevo.",
        );
      } catch {
        setEstado(previo);
        toast.error("No se pudo cambiar el estado. Probá de nuevo.");
      }
    });

  return (
    <div className="flex items-center gap-2 shrink-0">
      {estado === "contactado" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => mover("nuevo")}
          className={`${BTN} border-[#3dd68c] text-[#3dd68c] hover:bg-[#3dd68c]/10`}
          title="Se marcó por error: volvelo a dejar como nuevo"
        >
          Contactado
        </button>
      ) : estado === "descartado" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => mover("nuevo")}
          className={`${BTN} border-[#4c4546] text-[#8a8a8a] hover:border-[#e5e2e1] hover:text-[#e5e2e1]`}
          title="Reabrirlo"
        >
          Descartado
        </button>
      ) : (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => mover("contactado")}
            className={`${BTN} border-[#4c4546] text-[#e5e2e1] hover:border-[#e5e2e1]`}
          >
            {pending ? "Guardando..." : "Marcar contactado"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => mover("descartado")}
            className={`${BTN} border-transparent text-[#8a8a8a] hover:text-[#ffb4ab]`}
          >
            Descartar
          </button>
        </>
      )}
    </div>
  );
}
