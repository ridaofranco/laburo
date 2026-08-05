"use client";

/**
 * "Mis servicios": lo que convierte al proveedor de pasivo (espera que le pidan
 * una cotización) en activo (declara lo que hace y lo encuentran).
 *
 * Notas de producto, no de estilo:
 *  - La categoría es una lista sugerida MAS la opción de escribir la propia,
 *    porque la columna es text libre a propósito (en HITO las categorías son
 *    configurables por productora, ver lib/categorias-proveedor.ts).
 *  - El precio es OPCIONAL y orientativo, y así se dice en pantalla. El modelo
 *    sigue siendo cotización por evento, no un catálogo de precios públicos
 *    (es literalmente lo que dice el comentario de la tabla en la 0041).
 *  - Las provincias no son un adorno: sin al menos una, el perfil no se puede
 *    publicar, porque la búsqueda del movimiento 4 no lo encontraría.
 *  - Borrar pide confirmación en dos pasos, en la misma fila. Nada de un
 *    confirm() del navegador, que en el teléfono es un cartel ajeno a la app.
 *  - Después de cada operación se hace router.refresh() para releer del server:
 *    la fuente de verdad es la base, nunca una lista mantenida a mano acá.
 */

import { useState, useTransition } from "react";
import type { Acceso } from "@/lib/proveedor-acceso";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Plus, Pencil, Trash2, X, MapPin } from "lucide-react";
import { toast } from "sonner";
import { formatArsInput, parseArs } from "@/lib/format";
import { PROVINCIAS } from "@/lib/provincias";
import { CATEGORIAS_PROVEEDOR, UNIDADES_SERVICIO } from "@/lib/categorias-proveedor";
import { borrarServicio, guardarServicio } from "./actions";
import type { ServicioProveedor } from "./estados";

const OTRA = "__otra__";

const labelCls = "text-label font-semibold text-fg-muted";
const inputCls =
  "w-full min-h-[48px] rounded-xl bg-surface-2 border border-border text-fg text-body placeholder:text-fg-subtle px-md outline-none focus:ring-[3px] focus:ring-accent/45";

interface Draft {
  servicio_id: string | null;
  categoria: string;
  categoriaOtra: string;
  titulo: string;
  descripcion: string;
  precio_desde: string;
  unidad: string;
  provincias: string[];
}

const VACIO: Draft = {
  servicio_id: null,
  categoria: "",
  categoriaOtra: "",
  titulo: "",
  descripcion: "",
  precio_desde: "",
  unidad: "",
  provincias: [],
};

/** Un servicio existente pasado al form: si su categoría no está en la lista
 *  sugerida, se abre directamente el campo de escribir la propia. */
function aDraft(s: ServicioProveedor): Draft {
  const enCatalogo = CATEGORIAS_PROVEEDOR.includes(s.categoria);
  return {
    servicio_id: s.id,
    categoria: enCatalogo ? s.categoria : OTRA,
    categoriaOtra: enCatalogo ? "" : s.categoria,
    titulo: s.titulo ?? "",
    descripcion: s.descripcion ?? "",
    // Al abrir para editar, el precio se muestra ya formateado en argentino.
    // Con String() pelado, un servicio de 15000 volvía al input como "15000" y
    // la persona veía algo distinto de lo que la ficha mostraba abajo.
    precio_desde: s.precio_desde == null ? "" : formatArsInput(String(s.precio_desde).replace(".", ",")),
    unidad: s.unidad ?? "",
    provincias: s.provincias ?? [],
  };
}

/** Precio legible, con unidad si está cargada. null si no hay precio. */
function textoPrecio(s: ServicioProveedor): string | null {
  if (s.precio_desde == null || Number.isNaN(Number(s.precio_desde))) return null;
  const monto = `$${Number(s.precio_desde).toLocaleString("es-AR")}`;
  const moneda = s.moneda && s.moneda !== "ARS" ? ` ${s.moneda}` : "";
  return `Desde ${monto}${moneda}${s.unidad ? ` ${s.unidad}` : ""}`;
}

export function Servicios({
  acceso,
  servicios,
}: {
  acceso: Acceso;
  servicios: ServicioProveedor[];
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [draft, setDraft] = useState<Draft>(VACIO);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  function abrirNuevo() {
    setDraft(VACIO);
    setAbierto(true);
  }

  function abrirEdicion(s: ServicioProveedor) {
    setDraft(aDraft(s));
    setAbierto(true);
  }

  function toggleProvincia(p: string) {
    setDraft((d) => ({
      ...d,
      provincias: d.provincias.includes(p)
        ? d.provincias.filter((x) => x !== p)
        : [...d.provincias, p],
    }));
  }

  function guardar() {
    if (pending) return;
    const categoria =
      draft.categoria === OTRA ? draft.categoriaOtra.trim() : draft.categoria.trim();

    if (!categoria) {
      toast.error("Elegí o escribí una categoría para el servicio.");
      return;
    }
    if (!draft.titulo.trim()) {
      toast.error("Poné un título para el servicio.");
      return;
    }

    // Antes acá había `.replace(",", ".")` y `Number()`, que leía "15.000"
    // como 15 (el punto es separador de MILES en argentino, no decimal) y
    // encima, cuando no podía, avisaba "no puede ser negativo": le echaba la
    // culpa a la persona de un número que había escrito bien.
    const resultado = parseArs(draft.precio_desde);
    if (!resultado.ok) {
      toast.error("No pude leer el precio. Escribilo así: 15.000 o 15.000,50");
      return;
    }
    const precio = resultado.valor;

    startTransition(async () => {
      try {
        const res = await guardarServicio(acceso, {
          servicio_id: draft.servicio_id,
          categoria,
          titulo: draft.titulo,
          descripcion: draft.descripcion,
          precio_desde: precio,
          moneda: "ARS",
          unidad: draft.unidad,
          provincias: draft.provincias,
        });
        if (res.ok) {
          toast.success(draft.servicio_id ? "Servicio actualizado." : "Servicio agregado.");
          setAbierto(false);
          setDraft(VACIO);
          router.refresh();
          return;
        }
        toast.error(res.mensaje);
        if (res.terminal) router.refresh();
      } catch {
        toast.error("Algo falló. Probá de nuevo en un momento.");
      }
    });
  }

  function borrar(id: string) {
    if (pending) return;
    startTransition(async () => {
      try {
        const res = await borrarServicio(acceso, id);
        if (res.ok) {
          toast.success("Servicio borrado.");
          setConfirmando(null);
          router.refresh();
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
      {servicios.length === 0 && (
        <p className="text-body text-fg-muted">
          Todavía no cargaste ninguno. Agregá el primero y contá qué hacés y
          dónde.
        </p>
      )}

      <ul className="flex flex-col gap-sm">
        {servicios.map((s) => {
          const precio = textoPrecio(s);
          return (
            <li
              key={s.id}
              className="flex flex-col gap-sm rounded-xl bg-surface-2 border border-border p-md"
            >
              <div className="flex flex-col gap-xs">
                <span className="label-tech text-[11px] uppercase tracking-[0.1em] text-accent">
                  {s.categoria}
                </span>
                <span className="text-body text-fg">{s.titulo}</span>
                {s.descripcion && (
                  <span className="text-label text-fg-muted whitespace-pre-line">
                    {s.descripcion}
                  </span>
                )}
                {precio && <span className="text-label text-fg-muted">{precio}</span>}
                {s.provincias.length > 0 && (
                  <span className="flex items-start gap-xs text-label text-fg-subtle">
                    <MapPin size={14} aria-hidden="true" className="mt-[2px] shrink-0" />
                    {s.provincias.join(", ")}
                  </span>
                )}
              </div>

              {confirmando === s.id ? (
                <div className="flex items-center gap-sm">
                  <span className="flex-1 text-label text-fg">
                    ¿Lo borramos?
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => borrar(s.id)}
                    className="min-h-[44px] px-md rounded-xl bg-destructive text-surface-0 text-label font-semibold disabled:opacity-60"
                  >
                    Sí, borrar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmando(null)}
                    className="min-h-[44px] px-md text-label font-semibold text-fg-muted"
                  >
                    No
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-sm">
                  <button
                    type="button"
                    onClick={() => abrirEdicion(s)}
                    className="flex items-center gap-xs min-h-[44px] px-md rounded-xl bg-surface-1 border border-border text-label font-semibold text-fg"
                  >
                    <Pencil size={15} aria-hidden="true" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmando(s.id)}
                    className="flex items-center gap-xs min-h-[44px] px-md text-label font-semibold text-fg-muted"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    Borrar
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={abrirNuevo}
        className="flex items-center justify-center gap-xs min-h-[48px] rounded-none bg-fg text-surface-0 border border-fg label-tech text-[13px] px-md transition-colors hover:bg-transparent hover:text-fg"
      >
        <Plus size={16} aria-hidden="true" />
        Agregar un servicio
      </button>

      {/* Bottom sheet: Base UI Dialog para el shell accesible (focus trap +
          backdrop) y motion para el slide-up, mismo patrón que los filtros de
          la búsqueda. En el teléfono se siente nativo y no tapa el teclado. */}
      <Dialog.Root open={abierto} onOpenChange={setAbierto}>
        <AnimatePresence>
          {abierto && (
            <Dialog.Portal keepMounted>
              <Dialog.Backdrop
                render={
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduce ? 0 : 0.2 }}
                    className="fixed inset-0 z-40 bg-black/60"
                  />
                }
              />
              <Dialog.Popup
                render={
                  <motion.div
                    initial={reduce ? { y: 0 } : { y: "100%" }}
                    animate={{ y: 0 }}
                    exit={reduce ? { y: 0 } : { y: "100%" }}
                    transition={{ type: "tween", duration: reduce ? 0 : 0.25 }}
                    className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[520px] max-h-[90vh] flex flex-col rounded-t-2xl bg-surface-1 border-t border-border outline-none"
                  />
                }
              >
                <div className="flex items-center justify-between px-md pt-md pb-sm">
                  <Dialog.Title className="font-display text-[24px] text-fg">
                    {draft.servicio_id ? "Editar servicio" : "Nuevo servicio"}
                  </Dialog.Title>
                  <Dialog.Close
                    aria-label="Cerrar"
                    className="grid place-items-center w-11 h-11 -mr-2 rounded-full text-fg-muted"
                  >
                    <X size={20} aria-hidden="true" />
                  </Dialog.Close>
                </div>

                <div className="flex-1 overflow-y-auto px-md py-sm flex flex-col gap-lg">
                  <label className="flex flex-col gap-sm">
                    <span className={labelCls}>Categoría</span>
                    <select
                      value={draft.categoria}
                      onChange={(e) => set("categoria", e.target.value)}
                      className={`${inputCls} appearance-none [color-scheme:dark]`}
                    >
                      <option value="">Elegí una categoría</option>
                      {CATEGORIAS_PROVEEDOR.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value={OTRA}>Otra (la escribo yo)</option>
                    </select>
                  </label>

                  {draft.categoria === OTRA && (
                    <label className="flex flex-col gap-sm">
                      <span className={labelCls}>¿Cuál?</span>
                      <input
                        type="text"
                        value={draft.categoriaOtra}
                        onChange={(e) => set("categoriaOtra", e.target.value)}
                        placeholder="Pirotecnia"
                        maxLength={120}
                        className={inputCls}
                      />
                    </label>
                  )}

                  <label className="flex flex-col gap-sm">
                    <span className={labelCls}>Título</span>
                    <input
                      type="text"
                      value={draft.titulo}
                      onChange={(e) => set("titulo", e.target.value)}
                      placeholder="Catering para eventos corporativos"
                      maxLength={200}
                      className={inputCls}
                    />
                  </label>

                  <label className="flex flex-col gap-sm">
                    <span className={labelCls}>Descripción</span>
                    <textarea
                      value={draft.descripcion}
                      onChange={(e) => set("descripcion", e.target.value)}
                      placeholder="Qué incluye, para cuánta gente, con cuánto aviso."
                      maxLength={2000}
                      rows={3}
                      className={`${inputCls} py-sm resize-y`}
                    />
                  </label>

                  <div className="flex flex-col gap-sm">
                    <span className={labelCls}>Precio desde (opcional)</span>
                    <div className="flex items-center gap-sm">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={draft.precio_desde}
                        // Se formatea mientras escribe: tecleás 15000 y ves
                        // 15.000. formatArsInput es idempotente a propósito, si
                        // no lo fuera el input pelearía contra cada tecla.
                        onChange={(e) => set("precio_desde", formatArsInput(e.target.value))}
                        placeholder="15.000"
                        className={`${inputCls} flex-1`}
                      />
                      <select
                        value={draft.unidad}
                        onChange={(e) => set("unidad", e.target.value)}
                        aria-label="Unidad del precio"
                        className={`${inputCls} flex-1 appearance-none [color-scheme:dark]`}
                      >
                        <option value="">Unidad</option>
                        {UNIDADES_SERVICIO.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                    <span className="text-label text-fg-subtle">
                      Es orientativo, en pesos, para que te encuentren por rango.
                      Cada evento se sigue cotizando aparte.
                    </span>
                  </div>

                  <div className="flex flex-col gap-sm">
                    <span className={labelCls}>¿En qué provincias trabajás?</span>
                    <div className="flex flex-wrap gap-xs">
                      {PROVINCIAS.map((p) => {
                        const elegida = draft.provincias.includes(p);
                        return (
                          <button
                            key={p}
                            type="button"
                            aria-pressed={elegida}
                            onClick={() => toggleProvincia(p)}
                            className={`min-h-[44px] px-md rounded-full border text-label transition-colors ${
                              elegida
                                ? "bg-accent border-accent text-white"
                                : "bg-surface-2 border-border text-fg-muted"
                            }`}
                          >
                            {p}
                          </button>
                        );
                      })}
                    </div>
                    <span className="text-label text-fg-subtle">
                      Sin al menos una provincia no vas a poder publicarte: nadie
                      te podría encontrar.
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-md px-md pt-sm border-t border-border pb-[max(var(--spacing-md),env(safe-area-inset-bottom))]">
                  <button
                    type="button"
                    onClick={() => setAbierto(false)}
                    className="min-h-[48px] px-md text-label font-semibold text-fg-muted"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={guardar}
                    className="flex-1 min-h-[48px] rounded-none bg-fg text-surface-0 border border-fg label-tech text-[13px] transition-colors hover:bg-transparent hover:text-fg disabled:opacity-60 disabled:pointer-events-none"
                  >
                    {pending ? "Guardando…" : "Guardar servicio"}
                  </button>
                </div>
              </Dialog.Popup>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>
    </div>
  );
}
