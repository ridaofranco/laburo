"use client";

/**
 * Botón "quitar de favoritos" (client island) para la lista de Favoritos.
 *
 * Reusa la MISMA server action que el perfil (setCandidateNote) para no duplicar
 * la lógica de escritura ni el gate de membresía: marca is_favorite=false
 * preservando la nota privada existente, y refresca la ruta para que la fila
 * desaparezca. Optimista: oculta la fila apenas se dispara para que se sienta
 * inmediato, y revierte si el RPC falla.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { setCandidateNote } from "@/app/(portal)/staff/[id]/notes-actions";

export function FavoriteRemoveButton({
  staffProfileId,
  note,
}: {
  staffProfileId: string;
  note: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  function remove() {
    setError(false);
    startTransition(async () => {
      try {
        const res = await setCandidateNote({
          staffProfileId,
          isFavorite: false,
          note,
        });
        if (res.ok) {
          router.refresh();
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      aria-label={error ? "No se pudo quitar, reintentá" : "Quitar de favoritos"}
      className={`transition-colors duration-150 p-2 disabled:opacity-40 ${
        error ? "text-[#ffb4ab]" : "text-[#4c4546] hover:text-[#ffb4ab]"
      }`}
    >
      <X size={20} />
    </button>
  );
}
