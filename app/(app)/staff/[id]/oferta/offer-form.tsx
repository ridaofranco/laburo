"use client";

/**
 * Formulario pick-or-quick-create de oferta (OFER-01), client component.
 *
 * D-01: usa los tokens/patrones de Fase 2 (16px inputs anti-zoom iOS, targets
 * 44px+, Base UI Select como en filtros-sheet). Copy en voseo, sin em dash.
 *
 * Task 1 (este commit): arma la UI y el estado local. El botón de envío se
 * deshabilita mientras hay un submit en vuelo (Pitfall 5: evita doble oferta /
 * doble gig por doble-tap). El WRITE (crear gig + oferta + token) y el envío
 * (email + wa.me) se cablean en Task 2 via el server action createAndSendOffer;
 * este componente NUNCA inserta directo en offers/gigs (Pitfall 1).
 */

import { useState } from "react";
import { Select } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";

export interface OfferFormCandidate {
  id: string;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  email: string | null;
  oficios: string[] | null;
}

export interface OfferFormGig {
  id: string;
  title: string;
  starts_at: string | null;
  venue_name: string | null;
}

/** Valor centinela del Select para el branch "crear gig nuevo". */
const NEW_GIG = "__new__";

/** Etiqueta legible de un gig existente: título · fecha · lugar. */
function gigLabel(g: OfferFormGig): string {
  let when: string | null = null;
  if (g.starts_at) {
    const d = new Date(g.starts_at);
    if (!Number.isNaN(d.getTime())) {
      when = d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
    }
  }
  return [g.title, when, g.venue_name].filter(Boolean).join(" · ");
}

const inputCls =
  "w-full min-h-[44px] rounded-xl bg-surface-2 border border-border text-fg text-body placeholder:text-fg-muted px-md outline-none focus:ring-[3px] focus:ring-accent/45";

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-sm">
      <span className="text-label font-semibold text-fg-muted">{label}</span>
      {children}
      {hint ? <span className="text-label text-fg-subtle">{hint}</span> : null}
    </label>
  );
}

export function OfferForm({
  candidate,
  gigs,
}: {
  candidate: OfferFormCandidate;
  gigs: OfferFormGig[];
}) {
  // Rol pre-cargado con el primer oficio del candidato (editable).
  const defaultRole = (candidate.oficios ?? []).filter(Boolean)[0] ?? "";

  const [gigChoice, setGigChoice] = useState<string>(
    gigs.length ? gigs[0].id : NEW_GIG,
  );
  const [gigTitle, setGigTitle] = useState("");
  const [gigDate, setGigDate] = useState(""); // datetime-local → starts_at
  const [gigVenue, setGigVenue] = useState("");
  const [role, setRole] = useState(defaultRole);
  const [amount, setAmount] = useState("");
  const [conditions, setConditions] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNewGig = gigChoice === NEW_GIG;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return; // Pitfall 5: no re-entrar mientras hay envío en vuelo.
    setError(null);

    // Validación mínima client-side (la RPC igual re-valida server-side).
    if (!role.trim()) {
      setError("Poné el rol de la oferta.");
      return;
    }
    if (isNewGig && !gigTitle.trim()) {
      setError("El gig nuevo necesita al menos un nombre.");
      return;
    }
    if (!candidate.email && !candidate.telefono) {
      setError("Este candidato no tiene email ni teléfono cargado.");
      return;
    }

    setSubmitting(true);
    // TODO(Task 2): llamar createAndSendOffer y manejar sending/sent/failed +
    // el botón wa.me de fallback con el link mágico.
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
      {/* Gig: elegir existente o crear uno rápido */}
      <Field label="Gig / evento">
        <Select.Root
          value={gigChoice}
          onValueChange={(v: string | null) => setGigChoice(v ?? NEW_GIG)}
        >
          <Select.Trigger className="flex items-center justify-between gap-sm min-h-[44px] rounded-xl bg-surface-2 border border-border text-fg text-body px-md outline-none focus-visible:ring-[3px] focus-visible:ring-accent/45">
            <Select.Value>
              {(v: string) => {
                if (v === NEW_GIG) return "Crear gig nuevo";
                const g = gigs.find((x) => x.id === v);
                return g ? gigLabel(g) : "Elegí un gig";
              }}
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
            <Select.Positioner sideOffset={6} className="z-[60]">
              <Select.Popup className="max-h-[50vh] overflow-y-auto rounded-xl bg-surface-1 border border-border p-1 shadow-xl outline-none">
                <Select.Item
                  value={NEW_GIG}
                  className="flex items-center justify-between gap-sm min-h-[40px] rounded-lg px-sm text-body text-accent font-semibold cursor-pointer outline-none data-[highlighted]:bg-surface-2"
                >
                  <Select.ItemText>Crear gig nuevo</Select.ItemText>
                  <Select.ItemIndicator>
                    <Check size={16} className="text-accent" />
                  </Select.ItemIndicator>
                </Select.Item>
                {gigs.map((g) => (
                  <Select.Item
                    key={g.id}
                    value={g.id}
                    className="flex items-center justify-between gap-sm min-h-[40px] rounded-lg px-sm text-body text-fg cursor-pointer outline-none data-[highlighted]:bg-surface-2"
                  >
                    <Select.ItemText>{gigLabel(g)}</Select.ItemText>
                    <Select.ItemIndicator>
                      <Check size={16} className="text-accent" />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      </Field>

      {/* Quick-create: 3 campos que sólo aparecen para el gig nuevo */}
      {isNewGig && (
        <div className="flex flex-col gap-lg rounded-xl border border-border bg-surface-1 p-md">
          <Field label="Nombre del gig">
            <input
              type="text"
              value={gigTitle}
              onChange={(e) => setGigTitle(e.target.value)}
              placeholder="Ej: Festival en el Anfiteatro"
              className={inputCls}
            />
          </Field>
          <Field label="Fecha y hora" hint="Cuándo arranca el gig (opcional).">
            <input
              type="datetime-local"
              value={gigDate}
              onChange={(e) => setGigDate(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Lugar" hint="Opcional.">
            <input
              type="text"
              value={gigVenue}
              onChange={(e) => setGigVenue(e.target.value)}
              placeholder="Ej: Córdoba Capital"
              className={inputCls}
            />
          </Field>
        </div>
      )}

      {/* Rol (requerido) */}
      <Field label="Rol">
        <input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Ej: Sonidista"
          required
          className={inputCls}
        />
      </Field>

      {/* Monto informativo (opcional) */}
      <Field label="Monto" hint="Pago informativo, opcional.">
        <input
          type="text"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Ej: 80000"
          className={inputCls}
        />
      </Field>

      {/* Condiciones (opcional) */}
      <Field label="Condiciones" hint="Horarios, tareas, lo que quieras aclarar.">
        <textarea
          value={conditions}
          onChange={(e) => setConditions(e.target.value)}
          placeholder="Contale los detalles del laburo"
          rows={4}
          className="w-full rounded-xl bg-surface-2 border border-border text-fg text-body placeholder:text-fg-muted px-md py-sm outline-none focus:ring-[3px] focus:ring-accent/45"
        />
      </Field>

      {error ? (
        <p className="text-label text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="flex items-center justify-center gap-xs min-h-[48px] rounded-xl bg-accent box-glow text-fg text-label font-semibold px-md transition-transform active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
      >
        {submitting ? "Enviando…" : "Crear y enviar oferta"}
      </button>
    </form>
  );
}
