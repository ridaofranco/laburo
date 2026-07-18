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
import { ChevronDown, UserRoundSearch, UserRoundPlus, Pencil, MapPin, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { offerLabel } from "@/lib/offers";
import { createClientCheckout } from "./payment-actions";
import { fmtFecha, fmtHora } from "@/lib/dates";

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
  client_budget: number | null;
  client_payment_status: string | null;
}

export interface BoardAttendance {
  gig_id: string | null;
  staff_nombre: string | null;
  staff_apellido: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  check_in_distance_m: number | null;
}

// Radio "en el lugar": más lejos que esto, el fichaje se marca como sospechoso.
const GEOFENCE_M = 300;

/** Etiqueta de distancia al predio, o null si no hay dato (gig sin ubicación). */
function distanciaFichaje(m: number | null): { text: string; lejos: boolean } | null {
  if (m == null || Number.isNaN(m)) return null;
  const txt = m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
  return { text: txt, lejos: m > GEOFENCE_M };
}

export interface BoardGig {
  gig: BoardGigMeta;
  offers: BoardOffer[];
  attendance: BoardAttendance[];
  requiredTotal: number; // dotación requerida (suma de gig_slots), 0 si no se declaró
}

/** Hora corta es-AR (hora AR), o null. */
function shortTime(iso: string | null): string | null {
  return fmtHora(iso);
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

/** Fecha corta legible (es-AR, hora AR). null si vacía/inválida. */
function shortDate(iso: string | null): string | null {
  return fmtFecha(iso);
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
  const { gig, offers, attendance, requiredTotal } = item;
  const reduce = useReducedMotion();
  const resumen = resumenDe(offers);
  const faltan = Math.max(0, requiredTotal - resumen.cubierto);

  const cobrado = gig.client_payment_status === "paid";
  const puedeCobrar = (Number(gig.client_budget) || 0) > 0 && !cobrado;
  const [cobrando, setCobrando] = useState(false);
  async function cobrar() {
    if (cobrando) return;
    setCobrando(true);
    try {
      const res = await createClientCheckout(gig.id);
      if (res.ok && res.url) {
        window.open(res.url, "_blank", "noopener,noreferrer");
        toast.success("Link de pago generado. Mandáselo al cliente.");
      } else {
        toast.error(res.reason || "No se pudo generar el cobro.");
      }
    } catch {
      toast.error("No se pudo generar el cobro. Probá de nuevo.");
    } finally {
      setCobrando(false);
    }
  }
  // Abierto por defecto si hay un rol para volver a buscar (necesita atención) o
  // si ya hay gente fichada (para ver el check-in de un vistazo).
  const [open, setOpen] = useState(resumen.abierto > 0 || attendance.length > 0);

  const titulo = (gig.title ?? "").trim() || "Gig sin título";
  const fecha = shortDate(gig.starts_at);
  const venue = (gig.venue_name ?? "").trim();
  const meta = [fecha, venue].filter(Boolean).join(" · ");

  return (
    <li className="bg-[#0A0A0A] border border-[#1A1A1A] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-start gap-4 text-left min-h-[44px] px-6 py-5 hover:bg-[#131313]/40 transition-colors"
      >
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <span className="font-[family-name:var(--font-syne)] text-[22px] md:text-[26px] font-semibold uppercase tracking-tight leading-tight text-[#e5e2e1] truncate">
            {titulo}
          </span>
          {meta && <span className="label-tech text-[11px] text-[#cfc4c5] truncate">{meta}</span>}
          {requiredTotal > 0 ? (
            <span className={`label-tech text-[11px] mt-1 ${faltan > 0 ? "text-[#f5a623]" : "text-[#3dd68c]"}`}>
              {resumen.cubierto} de {requiredTotal} cubiertos
              {faltan > 0 ? ` · faltan ${faltan}` : " · completo"}
              {resumen.pendiente > 0 ? ` · ${resumen.pendiente} pendientes` : ""}
            </span>
          ) : (
            <span className="label-tech text-[11px] text-[#cfc4c5] mt-1">
              {resumen.cubierto} cubiertos · {resumen.pendiente} pendientes · {resumen.abierto} abiertos
            </span>
          )}
        </div>
        <motion.span
          aria-hidden="true"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: reduce ? 0 : 0.18 }}
          className="shrink-0 mt-1 text-[#cfc4c5]"
        >
          <ChevronDown size={18} />
        </motion.span>
      </button>

      {/* Acciones del evento (fuera del toggle: no anidar interactivos) */}
      <div className="flex items-center gap-4 px-6 pb-4 -mt-1">
        <Link
          href={`/tablero/${gig.id}/editar`}
          className="inline-flex items-center gap-2 label-tech text-[11px] text-[#cfc4c5] hover:text-[#e5e2e1] transition-colors"
        >
          <Pencil size={14} /> Editar
        </Link>
        <Link
          href={`/buscar?gig=${gig.id}`}
          className="inline-flex items-center gap-2 label-tech text-[11px] text-[#cfc4c5] hover:text-[#e5e2e1] transition-colors"
        >
          <UserRoundSearch size={14} /> Buscar staff
        </Link>
        {cobrado ? (
          <span className="inline-flex items-center gap-2 label-tech text-[11px] text-[#3dd68c]">
            <CreditCard size={14} /> Cobrado
          </span>
        ) : puedeCobrar ? (
          <button
            type="button"
            onClick={cobrar}
            disabled={cobrando}
            className="inline-flex items-center gap-2 label-tech text-[11px] text-[#b9c3ff] hover:text-[#e5e2e1] transition-colors disabled:opacity-50"
          >
            <CreditCard size={14} /> {cobrando ? "Generando…" : "Cobrar al cliente"}
          </button>
        ) : null}
      </div>

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
            <div className="px-6 pb-6 pt-2">
              {offers.length === 0 ? (
                <div className="flex flex-col items-start gap-3 bg-[#131313] border border-[#1A1A1A] px-6 py-5">
                  <span className="label-tech text-[11px] text-[#cfc4c5]">Sin ofertas todavía.</span>
                  <Link
                    href="/buscar"
                    className="inline-flex items-center gap-2 min-h-[44px] label-tech text-[12px] text-[#e5e2e1] hover:opacity-70 transition-opacity"
                  >
                    <UserRoundPlus size={16} aria-hidden="true" className="shrink-0" />
                    Buscar staff
                  </Link>
                </div>
              ) : (
                <ul className="flex flex-col gap-3">
                  {offers.map((o) => {
                    const label = offerLabel(o);
                    const abierto = coberturaDe(label) === "abierto";
                    const rol = (o.role ?? "").trim();
                    return (
                      <li
                        key={o.id}
                        className="flex flex-col gap-3 bg-[#131313] border border-[#1A1A1A] px-6 py-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 flex-col gap-1">
                            <span className="text-[16px] font-semibold text-[#e5e2e1] truncate uppercase">
                              {candidato(o)}
                            </span>
                            {rol && <span className="label-tech text-[11px] text-[#cfc4c5] truncate">{rol}</span>}
                          </div>
                          <span
                            className={`shrink-0 rounded-none label-tech text-[11px] font-semibold px-3 py-1 ${badgeTone(label)}`}
                          >
                            {label}
                          </span>
                        </div>
                        {abierto && (
                          <Link
                            href={`/buscar?gig=${gig.id}`}
                            className="inline-flex items-center gap-2 min-h-[44px] label-tech text-[12px] text-[#e5e2e1] hover:opacity-70 transition-opacity"
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

              {/* Asistencia (check-ins reales del staff) */}
              {attendance.length > 0 && (
                <div className="mt-4 border-t border-[#1A1A1A] pt-4">
                  <div className="flex items-center gap-2 label-tech text-[11px] text-[#cfc4c5] mb-3">
                    <MapPin size={14} /> Fichaje en el lugar
                  </div>
                  <ul className="flex flex-col gap-2">
                    {attendance.map((a, i) => {
                      const nombre =
                        [a.staff_nombre, a.staff_apellido].filter(Boolean).join(" ").trim() ||
                        "Staff";
                      const entrada = shortTime(a.check_in_at);
                      const salida = shortTime(a.check_out_at);
                      const dist = a.check_in_at ? distanciaFichaje(a.check_in_distance_m) : null;
                      return (
                        <li
                          key={i}
                          className="flex items-center justify-between gap-3 bg-[#131313] border border-[#1A1A1A] px-4 py-3"
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="text-[15px] text-[#e5e2e1] uppercase truncate">{nombre}</span>
                            {dist && (
                              <span
                                className={`label-tech text-[10px] ${dist.lejos ? "text-[#f5a623]" : "text-[#3dd68c]"}`}
                              >
                                {dist.lejos ? `lejos del predio (${dist.text})` : `en el lugar (${dist.text})`}
                              </span>
                            )}
                          </div>
                          <span className="shrink-0 label-tech text-[11px] text-[#cfc4c5]">
                            <span className="text-[#3dd68c]">↓ {entrada ?? "—"}</span>
                            <span className="mx-2 opacity-40">|</span>
                            <span>↑ {salida ?? "—"}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
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
      <div className="border-t border-b border-[#1A1A1A] px-6 py-16 text-center">
        <p className="text-[16px] text-[#cfc4c5]">Todavía no hay eventos cargados.</p>
        <Link
          href="/buscar"
          className="mt-4 inline-flex items-center justify-center min-h-[44px] label-tech text-[12px] text-[#e5e2e1] hover:opacity-70 border-b border-[#1A1A1A] pb-1 transition-opacity"
        >
          Buscar staff
        </Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-6">
      {board.map((item) => (
        <GigCard key={item.gig.id} item={item} />
      ))}
    </ul>
  );
}
