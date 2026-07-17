/**
 * Dashboard de Rentabilidad (porteo FIEL de "Yield Analysis / Analytics
 * Dashboard" de Stitch). Estética blueprint / minimalismo radical: fondo con
 * grilla, bento de métricas, mini bar-chart hecho con divs y tabla tipográfica
 * suiza. Datos ESTÁTICOS tal cual el HTML de Stitch (sin Supabase). Copy en
 * inglés, exactamente como el original. Tokens Material mapeados a hex
 * arbitrarios; Material Symbols -> lucide-react. Radio 0px. El layout del portal
 * ya pone el sidebar + <main md:pl-[280px]>, así que esto es SOLO el contenido.
 */

import { TrendingUp, Wallet } from "lucide-react";

// Grilla de fondo (grid-bg de Stitch): líneas de 1px #2a2a2a cada 40px.
const gridBg: React.CSSProperties = {
  backgroundSize: "40px 40px",
  backgroundImage:
    "linear-gradient(to right, #2a2a2a 1px, transparent 1px), linear-gradient(to bottom, #2a2a2a 1px, transparent 1px)",
};

const bars = [
  { h: "40%", highlight: false },
  { h: "60%", highlight: false },
  { h: "50%", highlight: false },
  { h: "85%", highlight: true },
];

const months = [
  { label: "JUL", active: false },
  { label: "AGO", active: false },
  { label: "SEP", active: false },
  { label: "OCT", active: true },
];

const roster = [
  { rank: "01", id: "STF-8892-ALPHA", rate: "99.8%", shifts: "142" },
  { rank: "02", id: "STF-1104-BRAVO", rate: "98.5%", shifts: "128" },
  { rank: "03", id: "STF-4421-DELTA", rate: "97.2%", shifts: "105" },
  { rank: "04", id: "STF-9099-ECHO", rate: "95.0%", shifts: "98" },
];

export default function RentabilidadPage() {
  return (
    <div
      className="flex-1 bg-[#131313] text-[#e5e2e1] overflow-x-hidden flex flex-col"
      style={gridBg}
    >
      <div className="w-full max-w-[1440px] mx-auto px-6 md:px-20 py-12 md:py-40 flex flex-col gap-40">
        {/* Header Section */}
        <section className="flex flex-col gap-6">
          <div className="flex justify-between items-end border-b border-[#2a2a2a] pb-2">
            <h2 className="font-[family-name:var(--font-syne)] text-[120px] font-extrabold text-[#e5e2e1] uppercase tracking-[-0.04em] leading-none">
              Análisis de
              <br />
              Rentabilidad
            </h2>
            <p className="label-tech text-[12px] text-[#cfc4c5] mb-2">
              Finanzas Q3 // 2024
            </p>
          </div>
        </section>

        {/* Massive Metrics Bento Grid */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Net Profit Margin (Massive) */}
          <div className="md:col-span-8 bg-[#0e0e0e] border border-[#2a2a2a] p-6 flex flex-col justify-between min-h-[400px] hover:border-[#b9c3ff] transition-colors duration-150">
            <div className="flex justify-between items-start">
              <span className="label-tech text-[12px] text-[#cfc4c5]">
                Margen neto
              </span>
              <TrendingUp size={24} className="text-[#b9c3ff] shrink-0" />
            </div>
            <div>
              <div className="font-[family-name:var(--font-syne)] text-[120px] font-extrabold text-[#e5e2e1] tracking-[-0.04em] leading-none">
                42.8<span className="text-[#cfc4c5]">%</span>
              </div>
              <div className="text-[16px] leading-[1.6] text-[#cfc4c5] mt-4 max-w-[448px]">
                Agregado en todas las sedes activas y planteles de staff.
                Refleja un índice de optimización de +3.2% (vs. el trimestre anterior).
              </div>
            </div>
          </div>

          {/* Projected Expenses / Burn Rate */}
          <div className="md:col-span-4 bg-[#0e0e0e] border border-[#2a2a2a] p-6 flex flex-col justify-between min-h-[400px] hover:border-[#b9c3ff] transition-colors duration-150">
            <div className="flex justify-between items-start">
              <span className="label-tech text-[12px] text-[#cfc4c5]">
                Gasto mensual proy.
              </span>
              <Wallet size={24} className="text-[#cfc4c5] shrink-0" />
            </div>
            {/* Ultra-minimalist Bar Chart */}
            <div className="w-full h-32 mt-8 border-b border-[#2a2a2a] relative flex items-end justify-between px-2 pb-2">
              {bars.map((bar, i) => (
                <div
                  key={i}
                  className={`w-8 ${bar.highlight ? "bg-[#c6c6c6]" : "bg-[#353535]"} hover:bg-[#b9c3ff] transition-colors cursor-crosshair`}
                  style={{ height: bar.h }}
                />
              ))}
            </div>
            <div className="flex justify-between label-tech text-[12px] text-[#cfc4c5] mt-2 px-2">
              {months.map((m) => (
                <span key={m.label} className={m.active ? "text-[#e5e2e1]" : ""}>
                  {m.label}
                </span>
              ))}
            </div>
            <div className="mt-8">
              <div className="font-[family-name:var(--font-syne)] text-[64px] font-bold text-[#e5e2e1] tracking-[-0.02em] leading-none">
                $1.2M
              </div>
            </div>
          </div>
        </section>

        {/* Staff Reliability Ranking (Swiss Typography Table) */}
        <section className="flex flex-col gap-6">
          <div className="border-b border-[#2a2a2a] pb-2 flex justify-between items-end">
            <h3 className="font-[family-name:var(--font-syne)] text-[32px] font-semibold text-[#e5e2e1] uppercase tracking-[-0.01em]">
              Índice de confiabilidad del staff
            </h3>
            <button
              type="button"
              className="label-tech text-[12px] text-[#e5e2e1] border border-[#4c4546] px-4 py-2 hover:bg-[#e5e2e1] hover:text-[#131313] transition-colors duration-150"
            >
              Exportar CSV
            </button>
          </div>
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="py-6 pr-6 label-tech text-[12px] text-[#cfc4c5] font-normal w-16">
                    Puesto
                  </th>
                  <th className="py-6 px-6 label-tech text-[12px] text-[#cfc4c5] font-normal">
                    ID del operativo
                  </th>
                  <th className="py-6 px-6 label-tech text-[12px] text-[#cfc4c5] font-normal text-right">
                    Tasa de cumplimiento
                  </th>
                  <th className="py-6 pl-6 label-tech text-[12px] text-[#cfc4c5] font-normal text-right">
                    Turnos registrados
                  </th>
                </tr>
              </thead>
              <tbody className="text-[18px]">
                {roster.map((r) => (
                  <tr
                    key={r.rank}
                    className="border-b border-[#2a2a2a] hover:bg-[#0e0e0e] transition-colors group cursor-crosshair"
                  >
                    <td className="py-6 pr-6 text-[#cfc4c5]">{r.rank}</td>
                    <td className="py-6 px-6 text-[#e5e2e1] font-medium group-hover:text-[#b9c3ff] transition-colors">
                      {r.id}
                    </td>
                    <td className="py-6 px-6 text-[#e5e2e1] text-right">
                      {r.rate}
                    </td>
                    <td className="py-6 pl-6 text-[#cfc4c5] text-right">
                      {r.shifts}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Footer Component */}
      <footer className="w-full px-6 md:px-20 py-6 flex flex-col md:flex-row justify-between items-center border-t border-[#4c4546] bg-[#131313] mt-40">
        <div className="label-tech text-[12px] text-[#cfc4c5] mb-4 md:mb-0 normal-case tracking-[0.1em]">
          ©2024 ARCHIVO DE MINIMALISMO RADICAL
        </div>
        <div className="flex gap-6">
          <a
            href="#"
            className="label-tech text-[12px] text-[#cfc4c5] hover:text-[#e5e2e1] transition-colors"
          >
            Privacidad
          </a>
          <a
            href="#"
            className="label-tech text-[12px] text-[#cfc4c5] hover:text-[#e5e2e1] transition-colors"
          >
            Términos
          </a>
          <a
            href="#"
            className="label-tech text-[12px] text-[#cfc4c5] hover:text-[#e5e2e1] transition-colors"
          >
            Estado de API
          </a>
        </div>
      </footer>
    </div>
  );
}
