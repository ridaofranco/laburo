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
import { fmtFecha } from "@/lib/dates";
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
  const when = fmtFecha(g.starts_at);
  return [g.title, when, g.venue_name].filter(Boolean).join(" · ");
}

// Input boxeado al lenguaje Stitch: superficie #131313, borde outline-variant
// #4c4546 que pasa a off-white en foco, texto #e5e2e1, radio 0. 16px anti-zoom iOS.
const inputCls =
  "w-full min-h-[44px] rounded-none bg-[#131313] border border-[#4c4546] text-[#e5e2e1] text-[16px] placeholder:text-[#565656] px-4 outline-none focus:border-[#e5e2e1] transition-colors";

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
    <label className="flex flex-col gap-3">
      <span className="label-tech text-[11px] text-[#cfc4c5]">{label}</span>
      {children}
      {hint ? <span className="text-[12px] text-[#565656]">{hint}</span> : null}
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
      <div className="flex flex-col gap-8">
        <div
          className="flex flex-col gap-2 rounded-none border border-[#1A1A1A] bg-[#0A0A0A] p-6"
          style={
            result.mailOk
              ? { borderColor: "#3dd68c66", backgroundColor: "#3dd68c14" }
              : undefined
          }
        >
          <p className="font-[family-name:var(--font-syne)] text-[22px] font-semibold text-[#e5e2e1]">
            {result.mailOk
              ? "Oferta enviada por email"
              : "Oferta creada, pero el email no salió"}
          </p>
          <p className="text-[14px] text-[#cfc4c5] leading-[1.6]">
            {result.mailOk
              ? "Le llegó la propuesta con el link para confirmar. Reforzá por WhatsApp si querés."
              : "La oferta quedó registrada igual. Mandale el link por WhatsApp así no se pierde."}
          </p>
          {!result.mailOk && result.mailError ? (
            <p className="text-[12px] text-[#565656] break-words">
              Detalle: {result.mailError}
            </p>
          ) : null}
        </div>

        {result.waLink ? (
          <a
            href={result.waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 min-h-[48px] rounded-none bg-[#25D366] text-white label-tech text-[12px] px-4 transition-transform active:scale-[0.98]"
          >
            <WhatsAppGlyph size={20} className="shrink-0" />
            {result.mailOk ? "Reforzar por WhatsApp" : "Enviar por WhatsApp"}
          </a>
        ) : (
          <p className="text-[13px] text-[#565656]">
            Este candidato no tiene teléfono cargado para el WhatsApp.
          </p>
        )}

        {/* El link mágico por si Franco quiere copiarlo a mano. */}
        <div className="flex flex-col gap-2">
          <span className="label-tech text-[11px] text-[#cfc4c5]">
            Link de la oferta
          </span>
          <span className="text-[13px] text-[#565656] break-all">
            {result.link}
          </span>
        </div>

        <Link
          href={`/staff/${candidate.id}`}
          className="inline-flex items-center gap-2 min-h-[44px] label-tech text-[12px] text-[#cfc4c5] hover:text-[#e5e2e1] transition-colors"
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
          <Select.Trigger className="flex items-center justify-between gap-3 min-h-[44px] rounded-none bg-[#131313] border border-[#4c4546] text-[#e5e2e1] text-[16px] px-4 outline-none focus-visible:border-[#e5e2e1] transition-colors">
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
                  className="text-[#cfc4c5]"
                />
              }
            />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner sideOffset={6} className="z-[60]">
              <Select.Popup className="max-h-[50vh] overflow-y-auto rounded-none bg-[#0A0A0A] border border-[#1A1A1A] p-1 shadow-xl outline-none">
                <Select.Item
                  value={NEW_GIG}
                  className="flex items-center justify-between gap-3 min-h-[40px] rounded-none px-3 text-[15px] text-[#b9c3ff] font-semibold cursor-pointer outline-none data-[highlighted]:bg-[#131313]"
                >
                  <Select.ItemText>Crear gig nuevo</Select.ItemText>
                  <Select.ItemIndicator>
                    <Check size={16} className="text-[#b9c3ff]" />
                  </Select.ItemIndicator>
                </Select.Item>
                {gigs.map((g) => (
                  <Select.Item
                    key={g.id}
                    value={g.id}
                    className="flex items-center justify-between gap-3 min-h-[40px] rounded-none px-3 text-[15px] text-[#e5e2e1] cursor-pointer outline-none data-[highlighted]:bg-[#131313]"
                  >
                    <Select.ItemText>{gigLabel(g)}</Select.ItemText>
                    <Select.ItemIndicator>
                      <Check size={16} className="text-[#b9c3ff]" />
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
        <div className="flex flex-col gap-6 rounded-none border border-[#1A1A1A] bg-[#0A0A0A] p-6">
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
          className="w-full rounded-none bg-[#131313] border border-[#4c4546] text-[#e5e2e1] text-[16px] placeholder:text-[#565656] px-4 py-3 outline-none focus:border-[#e5e2e1] transition-colors"
        />
      </Field>

      {error ? (
        <p className="text-[13px] text-[#ffb4ab]" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="flex items-center justify-center gap-xs min-h-[48px] rounded-none bg-fg text-surface-0 border border-fg label-tech text-[13px] px-md transition-colors hover:bg-transparent hover:text-fg disabled:opacity-60 disabled:pointer-events-none"
      >
        {submitting ? "Enviando…" : "Crear y enviar oferta"}
      </button>
    </form>
  );
}
