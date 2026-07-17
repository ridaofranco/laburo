/**
 * Calendario Maestro (porteo FIEL de "LABURO - Master Calendar" de Stitch).
 * Grilla mensual de eventos (grid-cols-7, Mon→Sun) + sidebar de detalle del día
 * seleccionado. El layout del portal ya provee el sidebar de navegación y el
 * <main md:pl-[280px]>; esta page devuelve SOLO el contenido principal: el canvas
 * del calendario + el aside de detalle. Colores/tipografías exactos de Stitch en
 * valores arbitrarios. Datos estáticos (octubre 2024), sin Supabase. Copy tal cual.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";

type Bar = { w: string; color: string; opacity?: string };
type Cell = { day: number; muted?: boolean; current?: boolean; events?: Bar[] };

// Octubre 2024: la grilla arranca en lunes. Oct 1 = martes → la semana 1 abre con
// el 30 de septiembre. 5 semanas (35 celdas), con arrastre de noviembre al final.
const CELLS: Cell[] = [
  // Semana 1
  { day: 30, muted: true },
  { day: 1, current: true },
  {
    day: 2,
    current: true,
    events: [
      { w: "w-full", color: "#454747", opacity: "opacity-50" },
      { w: "w-3/4", color: "#c6c6c6" },
    ],
  },
  { day: 3, current: true },
  { day: 4, current: true },
  {
    day: 5,
    current: true,
    events: [{ w: "w-full", color: "#4266ff" }],
  },
  { day: 6, current: true },
  // Semana 2
  { day: 7, current: true },
  { day: 8, current: true },
  {
    day: 9,
    current: true,
    events: [{ w: "w-2/3", color: "#b9c3ff" }],
  },
  { day: 10, current: true },
  { day: 11, current: true },
  {
    day: 12,
    current: true,
    events: [
      { w: "w-full", color: "#454747", opacity: "opacity-50" },
      { w: "w-1/2", color: "#c6c6c6" },
    ],
  },
  { day: 13, current: true },
  // Semana 3
  { day: 14, current: true },
  { day: 15, current: true },
  { day: 16, current: true },
  {
    day: 17,
    current: true,
    events: [{ w: "w-3/4", color: "#4266ff" }],
  },
  {
    day: 18,
    current: true,
    events: [
      { w: "w-full", color: "#c6c6c6" },
      { w: "w-2/3", color: "#454747", opacity: "opacity-50" },
    ],
  },
  { day: 19, current: true },
  { day: 20, current: true },
  // Semana 4
  { day: 21, current: true },
  { day: 22, current: true },
  {
    day: 23,
    current: true,
    events: [{ w: "w-1/2", color: "#b9c3ff" }],
  },
  { day: 24, current: true },
  { day: 25, current: true },
  {
    day: 26,
    current: true,
    events: [
      { w: "w-full", color: "#454747", opacity: "opacity-50" },
      { w: "w-3/4", color: "#c6c6c6" },
    ],
  },
  { day: 27, current: true },
  // Semana 5
  { day: 28, current: true },
  { day: 29, current: true },
  { day: 30, current: true },
  {
    day: 31,
    current: true,
    events: [{ w: "w-full", color: "#4266ff" }],
  },
  { day: 1, muted: true },
  { day: 2, muted: true },
  { day: 3, muted: true },
];

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function CalendarioPage() {
  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-dvh">
      {/* Canvas del calendario */}
      <div className="flex-1 flex flex-col border-r border-[#1A1A1A]">
        {/* Header del calendario */}
        <header className="p-8 md:p-20 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#1A1A1A] bg-[#0e0e0e]">
          <div>
            <h2 className="font-[family-name:var(--font-syne)] text-[40px] md:text-[64px] font-bold tracking-tighter text-[#c6c6c6] leading-none uppercase">
              OCTUBRE
            </h2>
            <div className="flex items-center gap-4 mt-2">
              <span className="font-[family-name:var(--font-syne)] text-[32px] font-semibold text-[#cfc4c5] tracking-tight">
                2024
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label="Mes anterior"
                  className="w-8 h-8 rounded-full border border-[#4c4546] flex items-center justify-center text-[#e5e2e1] hover:bg-[#c6c6c6] hover:text-[#0e0e0e] transition-all duration-200"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Mes siguiente"
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
              className="px-6 py-3 border border-[#4c4546] label-tech text-[12px] text-[#e5e2e1] hover:border-[#c6c6c6] transition-all duration-200"
            >
              Filtrar
            </button>
            <button
              type="button"
              className="px-6 py-3 bg-[#c6c6c6] text-[#0e0e0e] label-tech text-[12px] hover:bg-transparent hover:text-[#c6c6c6] border border-[#c6c6c6] transition-all duration-200"
            >
              Nuevo evento
            </button>
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

        {/* Cuerpo del calendario */}
        <div className="flex-1 grid grid-cols-7 bg-[#0e0e0e]">
          {CELLS.map((cell, i) => (
            <div
              key={i}
              className="border-b border-r border-[#1A1A1A] min-h-[140px] p-4 relative group hover:bg-[#2a2a2a]/50 transition-all duration-200"
            >
              <span
                className={`label-tech text-[12px] absolute top-2 right-2 ${
                  cell.muted ? "text-[#4c4546]" : "text-[#c6c6c6] font-bold"
                }`}
              >
                {cell.day}
              </span>
              {cell.events && (
                <div className="mt-8 space-y-1">
                  {cell.events.map((bar, j) => (
                    <div
                      key={j}
                      className={`${bar.w} h-1 rounded-full ${bar.opacity ?? ""}`}
                      style={{ backgroundColor: bar.color }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Sidebar de detalle (día seleccionado) */}
      <aside className="w-full md:w-[400px] flex flex-col bg-[#0e0e0e] border-l border-[#1A1A1A] min-h-[512px] md:min-h-dvh">
        <div className="p-8">
          <h3 className="font-[family-name:var(--font-syne)] text-[32px] font-semibold text-[#c6c6c6] mb-2">
            2 OCT
          </h3>
          <p className="text-[16px] text-[#cfc4c5]">
            Seleccioná un evento para ver los detalles.
          </p>
        </div>
      </aside>
    </div>
  );
}
