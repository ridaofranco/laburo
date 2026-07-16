"use client";

/**
 * Formulario pick-or-quick-create de oferta (OFER-01), client component.
 *
 * D-01: usa los tokens/patrones de Fase 2 (16px inputs anti-zoom iOS, targets
 * 44px+, Base UI Select como en filtros-sheet). Copy en voseo, sin em dash.
 *
 * Al enviar llama al server action createAndSendOffer (crea gig + oferta + token
 * atómico, arma el link mágico, renderiza y manda el email). El botón se
 * deshabilita mientras hay un submit en vuelo (Pitfall 5: evita doble oferta /
 * doble gig por doble-tap). Este componente NUNCA inserta directo en
 * offers/gigs (Pitfall 1) — todo el WRITE pasa por el action.
 *
 * Estado honesto (D-02): sending / sent / failed. Cuando el email falla, igual
 * se ofrece el botón wa.me con el MISMO link mágico (Pitfall 7: el raw token no
 * se puede recuperar de la DB, así que se reusa el link en memoria y no se crea
 * una segunda oferta). El botón wa.me usa el glifo OFICIAL de WhatsApp (D-03).
 */

import { useState } from "react";
import { Select } from "@base-ui/react/select";
import { Check, ChevronDown, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import { createAndSendOffer } from "../offer-actions";

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

/** Resultado de una creación exitosa: el link/waLink se reusan (Pitfall 7). */
interface SendResult {
  link: string;
  waLink: string;
  mailOk: boolean;
  mailError?: string;
}

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
  const [result, setResult] = useState<SendResult | null>(null);

  const isNewGig = gigChoice === NEW_GIG;
  const primerNombre = (candidate.nombre ?? "").trim().split(/\s+/)[0] ?? "";

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

    // El gig elegido aporta título/fecha/lugar para el copy del email + wa.me.
    const pickedGig = isNewGig
      ? null
      : (gigs.find((g) => g.id === gigChoice) ?? null);
    const parsedAmount = amount.trim()
      ? Number(amount.replace(/[^\d.]/g, ""))
      : null;

    setSubmitting(true);
    try {
      const res = await createAndSendOffer({
        staffProfileId: candidate.id,
        role: role.trim(),
        firstName: primerNombre,
        email: candidate.email,
        telefono: candidate.telefono,
        gigId: isNewGig ? null : gigChoice,
        gigTitle: isNewGig ? gigTitle.trim() : (pickedGig?.title ?? ""),
        gigStartsAt: isNewGig ? gigDate || null : (pickedGig?.starts_at ?? null),
        gigVenue: isNewGig ? gigVenue.trim() || null : (pickedGig?.venue_name ?? null),
        amount:
          parsedAmount != null && !Number.isNaN(parsedAmount)
            ? parsedAmount
            : null,
        conditions: conditions.trim() || null,
      });

      if (!res.ok) {
        setError(res.reason || "No se pudo crear la oferta.");
        return;
      }

      setResult({
        link: res.link,
        waLink: res.waLink,
        mailOk: res.mail.ok,
        mailError: res.mail.error,
      });
      if (res.mail.ok) {
        toast.success("Oferta enviada por email");
      } else {
        toast.warning("Oferta creada, pero el email no salió");
      }
    } catch (err) {
      setError(
        err instanceof Error && err.message === "forbidden"
          ? "No tenés permiso para crear ofertas."
          : "Algo falló al crear la oferta. Probá de nuevo.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Oferta ya creada: panel de estado honesto (D-02). Reusa el MISMO link para
  // el wa.me (Pitfall 7) — no se crea una segunda oferta al reforzar.
  if (result) {
    return (
      <div className="flex flex-col gap-lg">
        <div
          className="flex flex-col gap-xs rounded-xl border p-md"
          style={
            result.mailOk
              ? { borderColor: "#3dd68c66", backgroundColor: "#3dd68c14" }
              : undefined
          }
        >
          <p className="text-body font-semibold text-fg">
            {result.mailOk
              ? "Oferta enviada por email"
              : "Oferta creada, pero el email no salió"}
          </p>
          <p className="text-label text-fg-muted">
            {result.mailOk
              ? "Le llegó la propuesta con el link para confirmar. Reforzá por WhatsApp si querés."
              : "La oferta quedó registrada igual. Mandale el link por WhatsApp así no se pierde."}
          </p>
          {!result.mailOk && result.mailError ? (
            <p className="text-label text-fg-subtle break-words">
              Detalle: {result.mailError}
            </p>
          ) : null}
        </div>

        {result.waLink ? (
          <a
            href={result.waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-xs min-h-[48px] rounded-xl bg-[#25D366] text-white text-label font-semibold px-md transition-transform active:scale-[0.98]"
          >
            <WhatsAppGlyph size={20} className="shrink-0" />
            {result.mailOk ? "Reforzar por WhatsApp" : "Enviar por WhatsApp"}
          </a>
        ) : (
          <p className="text-label text-fg-subtle">
            Este candidato no tiene teléfono cargado para el WhatsApp.
          </p>
        )}

        {/* El link mágico por si Franco quiere copiarlo a mano. */}
        <div className="flex flex-col gap-xs">
          <span className="text-label font-semibold text-fg-muted">
            Link de la oferta
          </span>
          <span className="text-label text-fg-subtle break-all">
            {result.link}
          </span>
        </div>

        <Link
          href={`/staff/${candidate.id}`}
          className="inline-flex items-center gap-xs min-h-[44px] text-fg-muted text-label font-semibold"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          Volver al perfil
        </Link>
      </div>
    );
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
