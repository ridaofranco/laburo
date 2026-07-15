"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Select } from "@base-ui/react/select";
import { Switch } from "@base-ui/react/switch";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown, X } from "lucide-react";
import { PROVINCIAS } from "@/lib/provincias";

/** Filtros finos que maneja el bottom sheet (D-04 + SRCH-02). */
export interface FineFilters {
  provincia: string | null;
  ciudad: string;
  finde: boolean;
  viajar: boolean;
  movilidad: boolean;
  ocultarAsignados: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: FineFilters;
  onApply: (fine: FineFilters) => void;
}

const EMPTY: FineFilters = {
  provincia: null,
  ciudad: "",
  finde: false,
  viajar: false,
  movilidad: false,
  ocultarAsignados: false,
};

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-md min-h-[44px] cursor-pointer">
      <span className="text-body text-fg">{label}</span>
      <Switch.Root
        checked={checked}
        onCheckedChange={onChange}
        className="relative h-6 w-11 shrink-0 rounded-full bg-surface-2 border border-border transition-colors data-[checked]:bg-accent outline-none focus-visible:ring-[3px] focus-visible:ring-accent/45"
      >
        <Switch.Thumb className="block h-5 w-5 rounded-full bg-fg translate-x-0.5 transition-transform data-[checked]:translate-x-[22px]" />
      </Switch.Root>
    </label>
  );
}

/**
 * Filtros finos (D-04) como bottom sheet nativo-mobile: Base UI Dialog para el
 * shell accesible (focus trap + backdrop), Motion para el slide-up + fade.
 * Aplicar escribe los filtros en la URL (el server component los lee).
 */
export function FiltrosSheet({ open, onOpenChange, initial, onApply }: Props) {
  const reduce = useReducedMotion();
  const [draft, setDraft] = useState<FineFilters>(initial);

  // Sincronizar el draft cuando se abre (refleja el estado real de la URL).
  useEffect(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

  const apply = () => {
    onApply(draft);
    onOpenChange(false);
  };

  const clear = () => {
    setDraft(EMPTY);
    onApply(EMPTY);
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
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
                  className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[520px] max-h-[85vh] flex flex-col rounded-t-2xl bg-surface-1 border-t border-border outline-none"
                />
              }
            >
              {/* Encabezado */}
              <div className="flex items-center justify-between px-md pt-md pb-sm">
                <Dialog.Title className="text-heading font-semibold text-fg">
                  Filtros
                </Dialog.Title>
                <Dialog.Close
                  aria-label="Cerrar"
                  className="grid place-items-center w-11 h-11 -mr-2 rounded-full text-fg-muted"
                >
                  <X size={20} aria-hidden="true" />
                </Dialog.Close>
              </div>

              {/* Controles (scrollable) */}
              <div className="flex-1 overflow-y-auto px-md py-sm flex flex-col gap-lg">
                {/* Provincia (Base UI Select — 24 jurisdicciones) */}
                <div className="flex flex-col gap-sm">
                  <span className="text-label font-semibold text-fg-muted">
                    Provincia
                  </span>
                  <Select.Root
                    value={draft.provincia ?? ""}
                    onValueChange={(v: string | null) =>
                      setDraft((d) => ({ ...d, provincia: v ? v : null }))
                    }
                  >
                    <Select.Trigger className="flex items-center justify-between gap-sm min-h-[44px] rounded-xl bg-surface-2 border border-border text-fg text-body px-md outline-none focus-visible:ring-[3px] focus-visible:ring-accent/45">
                      <Select.Value>
                        {(v: string) =>
                          v && v.length ? v : "Todas las provincias"
                        }
                      </Select.Value>
                      <Select.Icon
                        render={
                          <ChevronDown
                            size={18}
                            aria-hidden="true"
                            className="text-fg-muted"
                          />
                        }
                      />
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Positioner
                        side="top"
                        sideOffset={6}
                        alignItemWithTrigger={false}
                        className="z-[60]"
                      >
                        <Select.Popup className="max-h-[50vh] overflow-y-auto rounded-xl bg-surface-1 border border-border p-1 shadow-xl outline-none">
                          <Select.Item
                            value=""
                            className="flex items-center justify-between gap-sm min-h-[40px] rounded-lg px-sm text-body text-fg cursor-pointer outline-none data-[highlighted]:bg-surface-2"
                          >
                            <Select.ItemText>Todas las provincias</Select.ItemText>
                            <Select.ItemIndicator>
                              <Check size={16} className="text-accent" />
                            </Select.ItemIndicator>
                          </Select.Item>
                          {PROVINCIAS.map((p) => (
                            <Select.Item
                              key={p}
                              value={p}
                              className="flex items-center justify-between gap-sm min-h-[40px] rounded-lg px-sm text-body text-fg cursor-pointer outline-none data-[highlighted]:bg-surface-2"
                            >
                              <Select.ItemText>{p}</Select.ItemText>
                              <Select.ItemIndicator>
                                <Check size={16} className="text-accent" />
                              </Select.ItemIndicator>
                            </Select.Item>
                          ))}
                        </Select.Popup>
                      </Select.Positioner>
                    </Select.Portal>
                  </Select.Root>
                </div>

                {/* Ciudad */}
                <div className="flex flex-col gap-sm">
                  <span className="text-label font-semibold text-fg-muted">
                    Ciudad
                  </span>
                  <input
                    type="text"
                    value={draft.ciudad}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, ciudad: e.target.value }))
                    }
                    placeholder="Escribí una ciudad"
                    className="w-full min-h-[44px] rounded-xl bg-surface-2 border border-border text-fg text-body placeholder:text-fg-muted px-md outline-none focus:ring-[3px] focus:ring-accent/45"
                  />
                </div>

                {/* Disponibilidad + movilidad */}
                <div className="flex flex-col gap-sm">
                  <span className="text-label font-semibold text-fg-muted">
                    Disponibilidad
                  </span>
                  <ToggleRow
                    label="Disponible el finde"
                    checked={draft.finde}
                    onChange={(v) => setDraft((d) => ({ ...d, finde: v }))}
                  />
                  <ToggleRow
                    label="Dispuesto a viajar"
                    checked={draft.viajar}
                    onChange={(v) => setDraft((d) => ({ ...d, viajar: v }))}
                  />
                  <ToggleRow
                    label="Movilidad propia"
                    checked={draft.movilidad}
                    onChange={(v) => setDraft((d) => ({ ...d, movilidad: v }))}
                  />
                  {/* SRCH-02 (UI-SPEC): "ocultar ya asignados a un gig solapado".
                      Versión mínimo-honesta: excluye a quien ya está en crew de
                      un gig; el solapamiento por intervalo real llega en Fase 3. */}
                  <ToggleRow
                    label="Ocultar ya asignados a un gig solapado"
                    checked={draft.ocultarAsignados}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, ocultarAsignados: v }))
                    }
                  />
                </div>
              </div>

              {/* Footer sticky (respeta safe-area-inset-bottom) */}
              <div className="flex items-center gap-md px-md pt-sm border-t border-border pb-[max(var(--spacing-md),env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={clear}
                  className="min-h-[44px] px-md text-label font-semibold text-fg-muted"
                >
                  Limpiar filtros
                </button>
                <button
                  type="button"
                  onClick={apply}
                  className="flex-1 min-h-[44px] rounded-xl bg-accent box-glow text-fg text-label font-semibold transition-transform active:scale-[0.98]"
                >
                  Aplicar
                </button>
              </div>
            </Dialog.Popup>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
