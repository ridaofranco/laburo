"use client";

/**
 * Calificación 1-5 + nota por gig (XTRA-04, D-06), client component.
 *
 * Producer-only: Franco califica al candidato después de cada gig en que fue
 * aceptado; siembra la confiabilidad del marketplace v2, invisible para el
 * candidato (Pitfall 2 — nada de esto vive en /o). Por cada gig aceptado se
 * renderiza una fila con 5 estrellas (Star de lucide-react, relleno hasta el
 * score elegido) + nota opcional + guardar → rateStaff (member-gated + RPC
 * autenticado). Este componente NUNCA escribe directo a staff_app.
 *
 * Si no hay gigs aceptados todavía, un microcopy honesto y cero controles.
 * useTransition para pending, toast honesto. Copy voseo, sin em dash. Targets
 * 44px+, mobile-first.
 */

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { rateStaff } from "./rating-actions";

export interface RatingGig {
  gigId: string;
  gigTitle: string;
  score: number | null;
  note: string | null;
}

function GigRating({
  staffProfileId,
  gig,
}: {
  staffProfileId: string;
  gig: RatingGig;
}) {
  const [score, setScore] = useState<number>(gig.score ?? 0);
  const [note, setNote] = useState(gig.note ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    if (score < 1 || score > 5) {
      toast.error("Elegí de 1 a 5 estrellas");
      return;
    }
    startTransition(async () => {
      try {
        const res = await rateStaff({
          staffProfileId,
          gigId: gig.gigId,
          score,
          note: note.trim() || null,
        });
        if (res.ok) {
          toast.success("Calificación guardada");
        } else if (res.reason === "score_out_of_range") {
          toast.error("La calificación tiene que ser de 1 a 5");
        } else {
          toast.error(res.reason ?? "No se pudo guardar");
        }
      } catch {
        toast.error("No se pudo guardar. Probá de nuevo.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-sm rounded-xl bg-surface-1 border border-border px-md py-sm">
      <span className="text-body font-semibold text-fg truncate">
        {gig.gigTitle}
      </span>

      <div className="flex items-center gap-xs" role="radiogroup" aria-label="Calificación">
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= score;
          return (
            <button
              key={n}
              type="button"
              onClick={() => setScore(n)}
              disabled={pending}
              aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
              aria-pressed={filled}
              className="grid place-items-center w-11 h-11 rounded-lg text-accent transition-transform active:scale-[0.9] disabled:opacity-60 disabled:pointer-events-none"
            >
              <Star
                size={22}
                aria-hidden="true"
                fill={filled ? "currentColor" : "none"}
                className={filled ? "text-accent" : "text-fg-muted"}
              />
            </button>
          );
        })}
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Nota de la calificación (opcional)"
        rows={2}
        className="w-full rounded-xl bg-surface-2 border border-border text-fg text-body placeholder:text-fg-muted px-md py-sm outline-none focus:ring-[3px] focus:ring-accent/45"
      />

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="flex items-center justify-center gap-xs self-start min-h-[44px] rounded-xl bg-accent box-glow text-fg text-label font-semibold px-md transition-transform active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
      >
        {pending ? "Guardando…" : "Guardar calificación"}
      </button>
    </div>
  );
}

export function Rating({
  staffProfileId,
  gigs,
}: {
  staffProfileId: string;
  gigs: RatingGig[];
}) {
  if (!gigs.length) {
    return (
      <p className="text-body text-fg-muted">
        Vas a poder calificarlo cuando trabaje en un gig.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-sm">
      {gigs.map((gig) => (
        <GigRating key={gig.gigId} staffProfileId={staffProfileId} gig={gig} />
      ))}
    </div>
  );
}
