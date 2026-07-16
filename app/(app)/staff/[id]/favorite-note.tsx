"use client";

/**
 * Favorito + nota privada del candidato (XTRA-01, D-03), client component.
 *
 * Producer-only: es memoria de Franco sobre el pool, invisible para el candidato
 * (Pitfall 2 — nada de esto vive en /o ni en get_public_offer). El toggle de
 * favorito (ícono Bookmark de lucide-react) guarda al toque (optimista) y la nota
 * privada se guarda con el botón "Guardar". Todo el WRITE pasa por el server
 * action setCandidateNote (member-gated + RPC autenticado); este componente NUNCA
 * escribe directo a staff_app.
 *
 * useTransition para el estado pending. Toast honesto: "Guardado" en éxito, error
 * real en fallo. Copy en voseo, sin em dash. Targets 44px+, mobile-first.
 */

import { useState, useTransition } from "react";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { setCandidateNote } from "./notes-actions";

export function FavoriteNote({
  staffProfileId,
  initialFavorite,
  initialNote,
}: {
  staffProfileId: string;
  initialFavorite: boolean;
  initialNote: string | null;
}) {
  const [favorite, setFavorite] = useState(initialFavorite);
  const [note, setNote] = useState(initialNote ?? "");
  const [pending, startTransition] = useTransition();

  function persist(nextFavorite: boolean, nextNote: string, okMsg: string) {
    startTransition(async () => {
      try {
        const res = await setCandidateNote({
          staffProfileId,
          isFavorite: nextFavorite,
          note: nextNote.trim() || null,
        });
        if (res.ok) {
          toast.success(okMsg);
        } else {
          toast.error(res.reason ?? "No se pudo guardar");
        }
      } catch {
        toast.error("No se pudo guardar. Probá de nuevo.");
      }
    });
  }

  function toggleFavorite() {
    const next = !favorite;
    setFavorite(next); // optimista
    persist(next, note, next ? "Guardado en favoritos" : "Sacado de favoritos");
  }

  function saveNote() {
    persist(favorite, note, "Guardado");
  }

  return (
    <div className="flex flex-col gap-sm">
      <button
        type="button"
        onClick={toggleFavorite}
        disabled={pending}
        aria-pressed={favorite}
        className={`flex items-center gap-xs self-start min-h-[44px] rounded-xl border px-md text-label font-semibold transition-transform active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none ${
          favorite
            ? "bg-accent/15 border-accent text-accent"
            : "bg-surface-2 border-border text-fg-muted"
        }`}
      >
        <Bookmark
          size={18}
          aria-hidden="true"
          className="shrink-0"
          fill={favorite ? "currentColor" : "none"}
        />
        {favorite ? "Favorito" : "Marcar favorito"}
      </button>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Nota privada (solo la ves vos)"
        rows={3}
        className="w-full rounded-xl bg-surface-2 border border-border text-fg text-body placeholder:text-fg-muted px-md py-sm outline-none focus:ring-[3px] focus:ring-accent/45"
      />
      <span className="text-label text-fg-subtle">
        Esta nota es privada. El candidato no la ve nunca.
      </span>

      <button
        type="button"
        onClick={saveNote}
        disabled={pending}
        className="flex items-center justify-center gap-xs self-start min-h-[44px] rounded-xl bg-accent box-glow text-fg text-label font-semibold px-md transition-transform active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
      >
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </div>
  );
}
