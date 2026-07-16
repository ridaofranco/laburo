"use client";

/**
 * Tablero de cobertura por gig (STAT-02), client component.
 *
 * NO hay slots de rol predefinidos: la cobertura se DERIVA de las ofertas de
 * cada gig (D-02) reusando `offerLabel()` como fuente única de la etiqueta —
 * "Vencida" = now() > expires_at, NUNCA el valor 'expired' del enum. El mapeo a
 * cobertura es: Aceptada → cubierto, Enviada/Vista → pendiente,
 * Rechazada/Vencida → abierto (rol para volver a buscar).
 *
 * El CTA "Buscar reemplazo" de un rol abierto es la puerta del re-filtro
 * XTRA-02: abre /?gig=<gigId>, donde la home oculta a los ya ofertados.
 * Copy en voseo, sin em dash. Tokens y clases del sistema existente.
 */

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { ChevronDown, UserRoundSearch, UserRoundPlus } from "lucide-react";
import { offerLabel } from "@/app/(app)/staff/[id]/offer-status";

export interface BoardOffer {
  id: string;
  gig_id: string | null;
  staff_profile_id: string | null;
  role: string | null;
  status: string | null;
  expires_at: string | null;
  sent_at: string | null;
  responded_at: string | null;
  gig_title: string | null;
  staff_nombre: string | null;
  staff_apellido: string | null;
}

export interface BoardGigMeta {
  id: string;
  title: string | null;
  starts_at: string | null;
  ends_at: string | null;
  venue_name: string | null;
  status: string | null;
}

export interface BoardGig {
  gig: BoardGigMeta;
  offers: BoardOffer[];
}

type Cobertura = "cubierto" | "pendiente" | "abierto";

/** Deriva la cobertura del rol a partir de la etiqueta única (offerLabel). */
function coberturaDe(label: string): Cobertura {
  if (label === "Aceptada") return "cubierto";
  if (label === "Rechazada" || label === "Vencida") return "abierto";
  return "pendiente"; // Enviada / Vista (todavía no vencida)
}

/** Tono del badge por etiqueta (equivalente a badgeClass del perfil, sin duplicar el import). */
function badgeTone(label: string): string {
  switch (label) {
    case "Aceptada":
      return "bg-positive/15 text-positive";
    case "Vencida":
      return "bg-[#f5a623]/15 text-[#f5a623]";
    case "Rechazada":
      return "bg-surface-2 text-fg-subtle";
    case "Vista":
      return "bg-surface-2 text-fg";
    default: // Enviada
      return "bg-surface-2 text-fg-muted";
  }
}

/** Fecha corta legible (es-AR). null si vacía/inválida. */
function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

/** Nombre visible del candidato de una oferta (staff_nombre + apellido). */
function candidato(o: BoardOffer): string {
  return [o.staff_nombre, o.staff_apellido].filter(Boolean).join(" ").trim() || "Sin nombre";
}

interface Resumen {
  cubierto: number;
  pendiente: number;
  abierto: number;
}

function resumenDe(offers: BoardOffer[]): Resumen {
  const r: Resumen = { cubierto: 0, pendiente: 0, abierto: 0 };
  for (const o of offers) r[coberturaDe(offerLabel(o))] += 1;
  return r;
}

function GigCard({ item }: { item: BoardGig }) {
  const { gig, offers } = item;
  const reduce = useReducedMotion();
  const resumen = resumenDe(offers);
  // Abierto por defecto si hay algún rol para volver a buscar (necesita atención).
  const [open, setOpen] = useState(resumen.abierto > 0);

  const titulo = (gig.title ?? "").trim() || "Gig sin título";
  const fecha = shortDate(gig.starts_at);
  const venue = (gig.venue_name ?? "").trim();
  const meta = [fecha, venue].filter(Boolean).join(" · ");

  return (
    <li className="rounded-xl bg-surface-1 border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-start gap-sm text-left min-h-[44px] px-md py-sm"
      >
        <div className="flex-1 min-w-0 flex flex-col gap-xs">
          <span className="text-body font-semibold text-fg truncate">{titulo}</span>
          {meta && <span className="text-label text-fg-muted truncate">{meta}</span>}
          <span className="text-label text-fg-subtle">
            {resumen.cubierto} cubiertos · {resumen.pendiente} pendientes · {resumen.abierto} abiertos
          </span>
        </div>
        <motion.span
          aria-hidden="true"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: reduce ? 0 : 0.18 }}
          className="shrink-0 mt-1 text-fg-muted"
        >
          <ChevronDown size={18} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-md pb-md pt-xs">
              {offers.length === 0 ? (
                <div className="flex flex-col items-start gap-sm rounded-xl bg-surface-2 border border-border px-md py-sm">
                  <span className="text-label text-fg-muted">Sin ofertas todavía.</span>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-xs min-h-[44px] text-accent text-label font-semibold"
                  >
                    <UserRoundPlus size={16} aria-hidden="true" className="shrink-0" />
                    Buscar staff
                  </Link>
                </div>
              ) : (
                <ul className="flex flex-col gap-sm">
                  {offers.map((o) => {
                    const label = offerLabel(o);
                    const abierto = coberturaDe(label) === "abierto";
                    const rol = (o.role ?? "").trim();
                    return (
                      <li
                        key={o.id}
                        className="flex flex-col gap-sm rounded-xl bg-surface-2 border border-border px-md py-sm"
                      >
                        <div className="flex items-start justify-between gap-sm">
                          <div className="flex min-w-0 flex-col gap-xs">
                            <span className="text-body font-semibold text-fg truncate">
                              {candidato(o)}
                            </span>
                            {rol && <span className="text-label text-fg-muted truncate">{rol}</span>}
                          </div>
                          <span
                            className={`shrink-0 rounded-full text-label font-semibold px-sm py-xs ${badgeTone(label)}`}
                          >
                            {label}
                          </span>
                        </div>
                        {abierto && (
                          <Link
                            href={`/?gig=${gig.id}`}
                            className="inline-flex items-center gap-xs min-h-[44px] text-accent text-label font-semibold"
                          >
                            <UserRoundSearch size={16} aria-hidden="true" className="shrink-0" />
                            Buscar reemplazo
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

export function GigBoard({ board }: { board: BoardGig[] }) {
  if (board.length === 0) {
    return (
      <div className="rounded-xl bg-surface-1 border border-border px-md py-lg text-center">
        <p className="text-body text-fg-muted">Todavía no hay eventos cargados.</p>
        <Link
          href="/"
          className="mt-sm inline-flex items-center justify-center min-h-[44px] text-accent text-label font-semibold"
        >
          Buscar staff
        </Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-md">
      {board.map((item) => (
        <GigCard key={item.gig.id} item={item} />
      ))}
    </ul>
  );
}
