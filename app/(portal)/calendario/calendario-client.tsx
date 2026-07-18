"use client";

/**
 * Calendario Maestro (client) — grilla mensual REAL alimentada por los gigs del
 * org. Navegación de meses (prev/next/hoy), barras por evento en cada día que el
 * gig abarca (starts_at..ends_at), y aside con el detalle del día seleccionado
 * (eventos, sede, horario, confirmados). Semana Lun→Dom, es-AR. Colores/tipos
 * exactos de Stitch en valores arbitrarios; el color de cada barra es
 * determinístico por gig (reusa la paleta de avatar). Sin datos inventados: si el
 * día no tiene eventos, el aside lo dice.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { oficioColor } from "@/lib/avatar-color";

export interface CalGig {
  id: string;
  title: string | null;
  starts_at: string | null;
  ends_at: string | null;
  venue_name: string | null;
  confirmed: number;
}

const MESES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
];
const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Índice de día lunes-based (0=Lun … 6=Dom). */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** Clave YYYY-M-D en hora local (sin desplazamiento de zona). */
function dayKey(y: number, m: number, d: number): string {
  return `${y}-${m}-${d}`;
}

/** Recorre los días (local) que abarca un gig y los mapea a su clave de día. */
function gigDayKeys(g: CalGig): string[] {
  if (!g.starts_at) return [];
  const start = new Date(g.starts_at);
  if (Number.isNaN(start.getTime())) return [];
  const endSrc = g.ends_at ? new Date(g.ends_at) : start;
  const end = Number.isNaN(endSrc.getTime()) ? start : endSrc;
  const keys: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  // Cap defensivo para no iterar rangos absurdos.
  let guard = 0;
  while (cur <= last && guard < 366) {
    keys.push(dayKey(cur.getFullYear(), cur.getMonth(), cur.getDate()));
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return keys;
}

function fmtHora(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export function CalendarioClient({ gigs }: { gigs: CalGig[] }) {
  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selected, setSelected] = useState<string | null>(
    dayKey(today.getFullYear(), today.getMonth(), today.getDate()),
  );

  // Mapa díaKey -> gigs de ese día.
  const byDay = useMemo(() => {
    const map = new Map<string, CalGig[]>();
    for (const g of gigs) {
      for (const k of gigDayKeys(g)) {
        const list = map.get(k);
        if (list) list.push(g);
        else map.set(k, [g]);
      }
    }
    return map;
  }, [gigs]);

  // Celdas del mes visible (con arrastre de mes anterior/siguiente para completar semanas).
  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const lead = mondayIndex(first);
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const out: { y: number; m: number; d: number; muted: boolean }[] = [];
    // Días del mes anterior.
    const prevDays = new Date(view.y, view.m, 0).getDate();
    for (let i = lead - 1; i >= 0; i--) {
      const d = prevDays - i;
      const pm = view.m === 0 ? 11 : view.m - 1;
      const py = view.m === 0 ? view.y - 1 : view.y;
      out.push({ y: py, m: pm, d, muted: true });
    }
    // Mes actual.
    for (let d = 1; d <= daysInMonth; d++) out.push({ y: view.y, m: view.m, d, muted: false });
    // Relleno hasta múltiplo de 7.
    let next = 1;
    while (out.length % 7 !== 0) {
      const nm = view.m === 11 ? 0 : view.m + 1;
      const ny = view.m === 11 ? view.y + 1 : view.y;
      out.push({ y: ny, m: nm, d: next++, muted: true });
    }
    return out;
  }, [view]);

  const todayKey = dayKey(today.getFullYear(), today.getMonth(), today.getDate());
  const selectedGigs = selected ? byDay.get(selected) ?? [] : [];
  const selectedDate = selected
    ? (() => {
        const [y, m, d] = selected.split("-").map(Number);
        return new Date(y, m, d);
      })()
    : null;

  function shiftMonth(delta: number) {
    setView((v) => {
      const nm = v.m + delta;
      if (nm < 0) return { y: v.y - 1, m: 11 };
      if (nm > 11) return { y: v.y + 1, m: 0 };
      return { y: v.y, m: nm };
    });
  }

  function goToday() {
    setView({ y: today.getFullYear(), m: today.getMonth() });
    setSelected(todayKey);
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-dvh">
      {/* Canvas del calendario */}
      <div className="flex-1 flex flex-col border-r border-[#1A1A1A]">
        {/* Header */}
        <header className="p-8 md:p-20 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#1A1A1A] bg-[#0e0e0e]">
          <div>
            <h2 className="font-[family-name:var(--font-syne)] text-[40px] md:text-[64px] font-bold tracking-tighter text-[#c6c6c6] leading-none uppercase">
              {MESES[view.m]}
            </h2>
            <div className="flex items-center gap-4 mt-2">
              <span className="font-[family-name:var(--font-syne)] text-[32px] font-semibold text-[#cfc4c5] tracking-tight">
                {view.y}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label="Mes anterior"
                  onClick={() => shiftMonth(-1)}
                  className="w-8 h-8 rounded-full border border-[#4c4546] flex items-center justify-center text-[#e5e2e1] hover:bg-[#c6c6c6] hover:text-[#0e0e0e] transition-all duration-200"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Mes siguiente"
                  onClick={() => shiftMonth(1)}
                  className="w-8 h-8 rounded-full border border-[#4c4546] flex items-center justify-center text-[#e5e2e1] hover:bg-[#c6c6c6] hover:text-[#0e0e0e] transition-all duration-200"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={goToday}
              className="px-6 py-3 border border-[#4c4546] label-tech text-[12px] text-[#e5e2e1] hover:border-[#c6c6c6] transition-all duration-200"
            >
              Hoy
            </button>
            <Link
              href="/tablero/nuevo"
              className="px-6 py-3 bg-[#c6c6c6] text-[#0e0e0e] label-tech text-[12px] hover:bg-transparent hover:text-[#c6c6c6] border border-[#c6c6c6] transition-all duration-200"
            >
              Nuevo evento
            </Link>
          </div>
        </header>

        {/* Encabezado de días */}
        <div className="grid grid-cols-7 border-b border-[#1A1A1A] bg-[#0e0e0e]/50">
          {DAY_NAMES.map((name, i) => (
            <div
              key={name}
              className={`p-4 label-tech text-[12px] text-[#cfc4c5] text-center ${
                i < 6 ? "border-r border-[#1A1A1A]" : ""
              }`}
            >
              {name}
            </div>
          ))}
        </div>

        {/* Cuerpo */}
        <div className="flex-1 grid grid-cols-7 bg-[#0e0e0e]">
          {cells.map((cell) => {
            const k = dayKey(cell.y, cell.m, cell.d);
            const dayGigs = byDay.get(k) ?? [];
            const isToday = k === todayKey;
            const isSelected = k === selected;
            return (
              <button
                type="button"
                key={k}
                onClick={() => setSelected(k)}
                className={`text-left border-b border-r border-[#1A1A1A] min-h-[120px] md:min-h-[140px] p-4 relative group transition-all duration-200 ${
                  isSelected ? "bg-[#2a2a2a]/60" : "hover:bg-[#2a2a2a]/40"
                }`}
              >
                <span
                  className={`label-tech text-[12px] absolute top-2 right-2 flex items-center justify-center ${
                    cell.muted
                      ? "text-[#4c4546]"
                      : isToday
                        ? "w-6 h-6 rounded-full bg-[#c6c6c6] text-[#0e0e0e] font-bold"
                        : "text-[#c6c6c6] font-bold"
                  }`}
                >
                  {cell.d}
                </span>
                {dayGigs.length > 0 && (
                  <div className="mt-8 space-y-1">
                    {dayGigs.slice(0, 3).map((g) => (
                      <div
                        key={g.id}
                        className="h-1 rounded-full w-full"
                        style={{ backgroundColor: oficioColor(g.id) }}
                      />
                    ))}
                    {dayGigs.length > 3 && (
                      <span className="label-tech text-[10px] text-[#cfc4c5]">
                        +{dayGigs.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Aside de detalle */}
      <aside className="w-full md:w-[400px] flex flex-col bg-[#0e0e0e] border-l border-[#1A1A1A] min-h-[512px] md:min-h-dvh">
        <div className="p-8">
          <h3 className="font-[family-name:var(--font-syne)] text-[32px] font-semibold text-[#c6c6c6] mb-2 uppercase">
            {selectedDate
              ? `${selectedDate.getDate()} ${MESES[selectedDate.getMonth()].slice(0, 3)}`
              : "Sin día"}
          </h3>
          {selectedGigs.length === 0 ? (
            <p className="text-[16px] text-[#cfc4c5]">
              No hay eventos este día. Elegí otro día o creá un evento nuevo.
            </p>
          ) : (
            <div className="flex flex-col gap-6 mt-6">
              {selectedGigs.map((g) => {
                const desde = fmtHora(g.starts_at);
                const hasta = fmtHora(g.ends_at);
                const horario = desde ? (hasta ? `${desde} - ${hasta}` : desde) : null;
                return (
                  <Link
                    key={g.id}
                    href="/tablero"
                    className="group block border-l-2 pl-4 py-1 hover:opacity-80 transition-opacity"
                    style={{ borderColor: oficioColor(g.id) }}
                  >
                    <p className="font-[family-name:var(--font-syne)] text-[20px] font-semibold text-[#e5e2e1] uppercase leading-tight">
                      {g.title?.trim() || "Evento sin título"}
                    </p>
                    {g.venue_name?.trim() && (
                      <p className="text-[14px] text-[#cfc4c5] mt-1">{g.venue_name}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 label-tech text-[11px] text-[#cfc4c5]">
                      {horario && <span>{horario}</span>}
                      <span>
                        {g.confirmed} {g.confirmed === 1 ? "confirmado" : "confirmados"}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
