"use client";

/**
 * Fichaje (client) — check-in/out por GPS para los eventos donde el staff está
 * confirmado. Pide la geolocalización del navegador (si la niega, ficha igual sin
 * coords, la RPC acepta null). Estado real por gig (entrada/salida). Estilos
 * Stitch. La verificación de que está confirmado la hace la RPC en el server.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MapPin, LogIn, LogOut, CheckCircle2 } from "lucide-react";
import { checkIn, checkOut } from "./actions";
import { fmtHora as fmtHoraTz } from "@/lib/dates";

export interface FichajeGig {
  gigId: string;
  title: string;
  venue: string | null;
  startsAt: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
}

const SYNE = "font-[family-name:var(--font-syne)]";

function hora(iso: string | null): string | null {
  return fmtHoraTz(iso);
}

function getCoords(): Promise<{ lat: number | null; lng: number | null }> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ lat: null, lng: null });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: null, lng: null }),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });
}

/**
 * Traduce el motivo que devuelve la RPC a algo que una persona pueda leer y,
 * sobre todo, RESOLVER.
 *
 * Hasta el 1/8 el fallback era `res.reason` crudo, así que en una pantalla de
 * celular, arriba de un escenario, aparecía la palabra "no_coords". Ni decía qué
 * pasaba ni qué hacer. Ese caso puntual ya no existe (la 0049 permite fichar sin
 * ubicación), pero el fallback crudo seguía tapando cualquier motivo futuro.
 *
 * Regla: cada motivo dice QUÉ pasó y QUÉ hacer. Y lo desconocido nunca se
 * muestra tal cual, se muestra como algo accionable.
 */
function motivoLegible(reason: string | undefined, salida: boolean): string {
  switch (reason) {
    case "not_confirmed":
      return "No figurás confirmado en este evento. Avisale a la productora.";
    case "not_authenticated":
    case "not_staff":
      return "Se cerró tu sesión. Entrá de nuevo y probá otra vez.";
    case "no_check_in_or_already_out":
      return "No tenés una entrada abierta en este evento.";
    case "bad_coords":
      return "Tu teléfono mandó una ubicación imposible. Cerrá y abrí la app, y probá de nuevo.";
    default:
      return salida
        ? "No se pudo fichar la salida. Probá de nuevo, y si sigue igual avisanos por WhatsApp."
        : "No se pudo fichar. Probá de nuevo, y si sigue igual avisanos por WhatsApp.";
  }
}

function GigCard({ gig }: { gig: FichajeGig }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const entrada = hora(gig.checkInAt);
  const salida = hora(gig.checkOutAt);

  async function doCheckIn() {
    if (busy) return;
    setBusy(true);
    try {
      const { lat, lng } = await getCoords();
      const res = await checkIn(gig.gigId, lat, lng);
      if (res.ok) {
        // Fichó igual sin ubicación (0049). Se avisa para que no se lleve la
        // sorpresa después, pero NO es un error: la entrada quedó registrada.
        toast.success(
          lat === null
            ? "Entrada registrada, sin ubicación"
            : "Entrada registrada",
        );
        router.refresh();
      } else {
        toast.error(motivoLegible(res.reason, false));
      }
    } catch {
      toast.error("No se pudo fichar. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function doCheckOut() {
    if (busy) return;
    setBusy(true);
    try {
      const { lat, lng } = await getCoords();
      const res = await checkOut(gig.gigId, lat, lng);
      if (res.ok) {
        toast.success(
          lat === null ? "Salida registrada, sin ubicación" : "Salida registrada",
        );
        router.refresh();
      } else {
        toast.error(motivoLegible(res.reason, true));
      }
    } catch {
      toast.error("No se pudo fichar. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const done = Boolean(entrada && salida);

  return (
    <div className="border border-[#1A1A1A] bg-[#0e0e0e] p-6 md:p-8 flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h3 className={`${SYNE} text-[24px] md:text-[28px] font-semibold text-[#e5e2e1] uppercase leading-tight`}>
          {gig.title}
        </h3>
        {gig.venue && <p className="text-[14px] text-[#cfc4c5]">{gig.venue}</p>}
      </div>

      <div className="flex items-center gap-6 label-tech text-[12px] text-[#cfc4c5]">
        <span>Entrada: <span className="text-[#e5e2e1]">{entrada ?? "—"}</span></span>
        <span>Salida: <span className="text-[#e5e2e1]">{salida ?? "—"}</span></span>
      </div>

      {done ? (
        <div className="flex items-center gap-3 text-[#3dd68c] label-tech text-[12px] uppercase tracking-widest">
          <CheckCircle2 size={20} />
          Jornada registrada
        </div>
      ) : entrada ? (
        <button
          type="button"
          onClick={doCheckOut}
          disabled={busy}
          className="flex items-center justify-center gap-3 bg-transparent text-[#e5e2e1] border border-[#c6c6c6] label-tech text-[12px] uppercase tracking-widest py-5 hover:bg-[#c6c6c6] hover:text-black transition-colors disabled:opacity-50"
        >
          <LogOut size={18} />
          {busy ? "Registrando…" : "Fichar salida"}
        </button>
      ) : (
        <button
          type="button"
          onClick={doCheckIn}
          disabled={busy}
          className="flex items-center justify-center gap-3 bg-[#c6c6c6] text-black border border-[#c6c6c6] label-tech text-[12px] uppercase tracking-widest py-5 hover:bg-transparent hover:text-[#c6c6c6] transition-colors disabled:opacity-50"
        >
          <LogIn size={18} />
          {busy ? "Registrando…" : "Fichar entrada"}
        </button>
      )}
    </div>
  );
}

export function FichajeClient({ gigs }: { gigs: FichajeGig[] }) {
  if (gigs.length === 0) {
    return (
      <div className="border-t border-b border-[#1A1A1A] py-16 text-center">
        <MapPin size={28} className="text-[#4c4546] mx-auto mb-4" />
        <p className="text-[16px] text-[#cfc4c5] max-w-[420px] mx-auto">
          No tenés eventos confirmados para fichar. Cuando confirmes una oferta,
          el evento aparece acá para registrar tu entrada y salida.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {gigs.map((g) => (
        <GigCard key={g.gigId} gig={g} />
      ))}
    </div>
  );
}
