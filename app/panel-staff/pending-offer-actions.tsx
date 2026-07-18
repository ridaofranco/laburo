"use client";

/**
 * Botones Aceptar / Rechazar de una oferta pendiente, en el panel del staff.
 * Llaman a las server actions (RPC self-scoped). Aceptar confirma al staff en el
 * evento (crea crew); rechazar la descarta. Refresca la lista al terminar.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { acceptMyOffer, declineMyOffer } from "./offer-actions";

export function PendingOfferActions({ offerId }: { offerId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "accept" | "decline">(null);

  async function run(kind: "accept" | "decline") {
    if (busy) return;
    setBusy(kind);
    try {
      const res =
        kind === "accept" ? await acceptMyOffer(offerId) : await declineMyOffer(offerId);
      if (res.ok) {
        toast.success(kind === "accept" ? "Confirmaste el evento" : "Oferta rechazada");
        router.refresh();
      } else {
        toast.error(
          res.reason === "invalid_or_expired"
            ? "La oferta ya no está disponible."
            : res.reason || "No se pudo procesar.",
        );
      }
    } catch {
      toast.error("No se pudo procesar. Probá de nuevo.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => run("accept")}
        disabled={busy !== null}
        className="inline-flex items-center gap-2 bg-[#c6c6c6] text-black label-tech text-[11px] uppercase tracking-widest px-5 py-3 border border-[#c6c6c6] hover:bg-transparent hover:text-[#c6c6c6] transition-colors disabled:opacity-50"
      >
        <Check size={14} />
        {busy === "accept" ? "…" : "Aceptar"}
      </button>
      <button
        type="button"
        onClick={() => run("decline")}
        disabled={busy !== null}
        className="inline-flex items-center gap-2 bg-transparent text-[#cfc4c5] label-tech text-[11px] uppercase tracking-widest px-4 py-3 border border-[#4c4546] hover:border-[#ffb4ab] hover:text-[#ffb4ab] transition-colors disabled:opacity-50"
      >
        <X size={14} />
        {busy === "decline" ? "…" : "Rechazar"}
      </button>
    </div>
  );
}
