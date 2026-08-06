"use client";

/**
 * "Publicarme": el último paso del proveedor, y el único que cambia si las
 * productoras lo encuentran o no.
 *
 * Lo importante acá es cómo se falla. La RPC no dice "no se pudo": devuelve la
 * lista de lo que falta, en códigos estables, y esta pantalla los traduce a algo
 * accionable ("agregá al menos un servicio", "decí en qué provincias trabajás").
 * Un proveedor que toca el botón y recibe un error crudo abandona; uno que
 * recibe una lista de dos ítems la completa.
 *
 * El motivo de que haya requisitos, y por eso está escrito en pantalla: sin
 * servicio y sin provincia la búsqueda no lo encuentra, o sea que publicarse
 * sería publicar algo invisible y quedarse esperando un pedido que no llega.
 *
 * No hay ningún control de verificación en esta pantalla, ni lo va a haber: eso
 * lo activa DER y ninguna RPC por token lo escribe.
 */

import { useState, useTransition } from "react";
import type { Acceso } from "@/lib/proveedor-acceso";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { publicar } from "./actions";
import { textoFalta } from "./estados";

export function Publicar({
  acceso,
  publicado,
  esSalon = false,
}: {
  acceso: Acceso;
  publicado: boolean;
  /** Cambia SOLO el texto. Los requisitos los decide la base (0067). */
  esSalon?: boolean;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [pending, startTransition] = useTransition();
  const [faltan, setFaltan] = useState<string[]>([]);
  const [recienPublicado, setRecienPublicado] = useState(false);

  function accionar(quiere: boolean) {
    if (pending) return;
    startTransition(async () => {
      try {
        const res = await publicar(acceso, quiere);
        if (res.ok) {
          setFaltan([]);
          setRecienPublicado(quiere);
          toast.success(
            quiere ? "Listo, ya estás publicado." : "Te despublicamos.",
          );
          router.refresh();
          return;
        }
        // Lo que falta se muestra en la pantalla, no en un toast que se va.
        if (res.faltan?.length) {
          setFaltan(res.faltan);
          setRecienPublicado(false);
          return;
        }
        toast.error(res.mensaje);
        if (res.terminal) router.refresh();
      } catch {
        toast.error("Algo falló. Probá de nuevo en un momento.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-md">
      <p className="text-body text-fg-muted">
        {esSalon
          ? publicado
            ? "Estás publicado. Te pueden encontrar por cuánta gente entra y por dónde queda el salón."
            : "Cuando te publiques, te van a poder encontrar por cuánta gente entra y por dónde queda el salón."
          : publicado
            ? "Estás publicado. Las productoras te pueden encontrar por lo que hacés y por dónde trabajás."
            : "Cuando te publiques, las productoras te van a poder encontrar por lo que hacés y por dónde trabajás."}
      </p>

      <button
        type="button"
        disabled={pending}
        onClick={() => accionar(!publicado)}
        className={
          publicado
            ? "flex items-center justify-center gap-xs min-h-[48px] rounded-xl bg-surface-2 border border-border text-fg text-label font-semibold px-md transition-transform active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
            : "flex items-center justify-center gap-xs min-h-[48px] rounded-none bg-fg text-surface-0 border border-fg label-tech text-[13px] px-md transition-colors hover:bg-transparent hover:text-fg disabled:opacity-60 disabled:pointer-events-none"
        }
      >
        {pending
          ? "Un momento…"
          : publicado
            ? "Despublicarme"
            : "Publicarme"}
      </button>

      {/* Lo que falta, listado y accionable. Nunca un código de error. */}
      <AnimatePresence>
        {faltan.length > 0 && (
          <motion.div
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.28, ease: "easeOut" }}
            className="flex flex-col gap-sm rounded-xl bg-surface-2 border border-border p-md"
          >
            <span className="flex items-center gap-xs text-label font-semibold text-fg">
              <AlertCircle size={16} aria-hidden="true" />
              Te falta esto para publicarte
            </span>
            <ul className="flex flex-col gap-xs">
              {faltan.map((f) => (
                <li key={f} className="text-label text-fg-muted">
                  {textoFalta(f)}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {recienPublicado && faltan.length === 0 && (
          <motion.p
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.28, ease: "easeOut" }}
            className="flex items-center gap-xs text-label text-positive"
          >
            <Check size={16} aria-hidden="true" />
            Ya te pueden encontrar.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
