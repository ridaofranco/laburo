/**
 * Dashboard de Rentabilidad (porteo FIEL del "Yield Analysis" de Stitch) con
 * DATOS REALES y HONESTOS. La estética blueprint/minimalismo radical se conserva
 * (grilla de fondo, bento, mini bar-chart de divs, tabla suiza), pero cada número
 * sale de las ofertas reales del org (RLS-scopeado): tasa de aceptación, monto
 * comprometido, ofertas por mes y la tabla de staff confirmado. Nada inventado:
 * sin ofertas, muestra estado vacío. El bar-chart es real (ofertas/mes).
 *
 * Server component. El layout del portal ya pone el sidebar + <main>.
 */

import Link from "next/link";
import { TrendingUp, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ExportCsvButton, type CsvRow } from "./export-csv-button";

const gridBg: React.CSSProperties = {
  backgroundSize: "40px 40px",
  backgroundImage:
    "linear-gradient(to right, #2a2a2a 1px, transparent 1px), linear-gradient(to bottom, #2a2a2a 1px, transparent 1px)",
};

interface OfferRow {
  id: string;
  amount: number | null;
  status: string | null;
  sent_at: string | null;
  responded_at: string | null;
  expires_at: string | null;
  gig_title: string | null;
  staff_nombre: string | null;
  staff_apellido: string | null;
}

const MES_ABR = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

/** Formato compacto para el número monumental ($1.2M, $840K, $12.500). */
function compactMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `$${Math.round(n / 1000)}K`;
  return money.format(n);
}

export default async function RentabilidadPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("staff_app_offers")
    .select(
      "id,amount,status,sent_at,responded_at,expires_at,gig_title,staff_nombre,staff_apellido",
    );
  const offers = (data ?? []) as OfferRow[];

  const total = offers.length;
  const accepted = offers.filter((o) => o.status === "accepted");
  const acceptedCount = accepted.length;
  const tasaAceptacion = total > 0 ? Math.round((acceptedCount / total) * 100) : null;
  const montoComprometido = accepted.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

  // Ofertas por mes: últimos 4 meses (incluye el actual), por sent_at.
  const now = new Date();
  const buckets: { label: string; count: number }[] = [];
  for (let i = 3; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ label: MES_ABR[d.getMonth()], count: 0 });
  }
  const firstBucket = new Date(now.getFullYear(), now.getMonth() - 3, 1).getTime();
  for (const o of offers) {
    if (!o.sent_at) continue;
    const t = new Date(o.sent_at);
    if (Number.isNaN(t.getTime()) || t.getTime() < firstBucket) continue;
    const idx = (t.getFullYear() - now.getFullYear()) * 12 + (t.getMonth() - now.getMonth()) + 3;
    if (idx >= 0 && idx < 4) buckets[idx].count++;
  }
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));

  // Tabla staff confirmado (ofertas aceptadas), orden por fecha desc.
  const roster = [...accepted].sort((a, b) => {
    const ta = a.responded_at ? new Date(a.responded_at).getTime() : 0;
    const tb = b.responded_at ? new Date(b.responded_at).getTime() : 0;
    return tb - ta;
  });
  const csvRows: CsvRow[] = roster.map((o) => ({
    nombre: [o.staff_nombre, o.staff_apellido].filter(Boolean).join(" ").trim() || "Sin nombre",
    gig: (o.gig_title ?? "").trim() || "Sin evento",
    monto: o.amount != null ? money.format(Number(o.amount)) : "",
    fecha: o.responded_at
      ? new Date(o.responded_at).toLocaleDateString("es-AR")
      : "",
  }));

  const sinDatos = total === 0;

  return (
    <div
      className="flex-1 bg-[#131313] text-[#e5e2e1] overflow-x-hidden flex flex-col"
      style={gridBg}
    >
      <div className="w-full max-w-[1440px] mx-auto px-6 md:px-20 py-12 md:py-40 flex flex-col gap-24 md:gap-40">
        {/* Header */}
        <section className="flex flex-col gap-6">
          <div className="flex justify-between items-end border-b border-[#2a2a2a] pb-2 gap-6">
            <h2 className="font-[family-name:var(--font-syne)] text-[48px] md:text-[120px] font-extrabold text-[#e5e2e1] uppercase tracking-[-0.04em] leading-none">
              Análisis de
              <br />
              Rentabilidad
            </h2>
            <p className="label-tech text-[12px] text-[#cfc4c5] mb-2 shrink-0">
              Ofertas y confirmaciones
            </p>
          </div>
        </section>

        {sinDatos ? (
          <div className="border border-[#2a2a2a] bg-[#0e0e0e] p-12 md:p-20 text-center">
            <p className="text-[16px] text-[#cfc4c5] max-w-[460px] mx-auto">
              Todavía no hay ofertas para analizar. Cuando empieces a enviar
              ofertas y a confirmar staff, acá vas a ver la tasa de aceptación, el
              monto comprometido y el ranking de tu equipo.
            </p>
            <Link
              href="/buscar"
              className="mt-6 inline-block label-tech text-[12px] text-[#e5e2e1] hover:opacity-70 border-b border-[#2a2a2a] pb-1"
            >
              Buscar staff
            </Link>
          </div>
        ) : (
          <>
            {/* Bento de métricas reales */}
            <section className="grid grid-cols-1 md:grid-cols-12 gap-8">
              {/* Tasa de aceptación (grande) */}
              <div className="md:col-span-8 bg-[#0e0e0e] border border-[#2a2a2a] p-6 flex flex-col justify-between min-h-[400px] hover:border-[#b9c3ff] transition-colors duration-150">
                <div className="flex justify-between items-start">
                  <span className="label-tech text-[12px] text-[#cfc4c5]">
                    Tasa de aceptación
                  </span>
                  <TrendingUp size={24} className="text-[#b9c3ff] shrink-0" />
                </div>
                <div>
                  <div className="font-[family-name:var(--font-syne)] text-[80px] md:text-[120px] font-extrabold text-[#e5e2e1] tracking-[-0.04em] leading-none">
                    {tasaAceptacion ?? 0}
                    <span className="text-[#cfc4c5]">%</span>
                  </div>
                  <div className="text-[16px] leading-[1.6] text-[#cfc4c5] mt-4 max-w-[448px]">
                    {acceptedCount} de {total}{" "}
                    {total === 1 ? "oferta enviada fue aceptada" : "ofertas enviadas fueron aceptadas"}.
                    El resto sigue abierta, vista o vencida.
                  </div>
                </div>
              </div>

              {/* Monto comprometido + ofertas/mes */}
              <div className="md:col-span-4 bg-[#0e0e0e] border border-[#2a2a2a] p-6 flex flex-col justify-between min-h-[400px] hover:border-[#b9c3ff] transition-colors duration-150">
                <div className="flex justify-between items-start">
                  <span className="label-tech text-[12px] text-[#cfc4c5]">
                    Ofertas por mes
                  </span>
                  <Wallet size={24} className="text-[#cfc4c5] shrink-0" />
                </div>
                {/* Bar chart real */}
                <div className="w-full h-32 mt-8 border-b border-[#2a2a2a] relative flex items-end justify-between px-2 pb-2">
                  {buckets.map((b, i) => {
                    const isLast = i === buckets.length - 1;
                    const h = `${Math.max(6, Math.round((b.count / maxCount) * 100))}%`;
                    return (
                      <div
                        key={b.label + i}
                        className={`w-8 ${isLast ? "bg-[#c6c6c6]" : "bg-[#353535]"} hover:bg-[#b9c3ff] transition-colors`}
                        style={{ height: h }}
                        title={`${b.count} ${b.count === 1 ? "oferta" : "ofertas"}`}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between label-tech text-[12px] text-[#cfc4c5] mt-2 px-2">
                  {buckets.map((b, i) => (
                    <span key={b.label + i} className={i === 3 ? "text-[#e5e2e1]" : ""}>
                      {b.label}
                    </span>
                  ))}
                </div>
                <div className="mt-8">
                  <span className="label-tech text-[11px] text-[#cfc4c5] block mb-1">
                    Monto comprometido
                  </span>
                  <div className="font-[family-name:var(--font-syne)] text-[48px] md:text-[64px] font-bold text-[#e5e2e1] tracking-[-0.02em] leading-none">
                    {compactMoney(montoComprometido)}
                  </div>
                </div>
              </div>
            </section>

            {/* Tabla staff confirmado */}
            <section className="flex flex-col gap-6">
              <div className="border-b border-[#2a2a2a] pb-2 flex justify-between items-end gap-4">
                <h3 className="font-[family-name:var(--font-syne)] text-[24px] md:text-[32px] font-semibold text-[#e5e2e1] uppercase tracking-[-0.01em]">
                  Staff confirmado
                </h3>
                <ExportCsvButton rows={csvRows} />
              </div>
              {roster.length === 0 ? (
                <p className="text-[16px] text-[#cfc4c5] py-8">
                  Todavía nadie aceptó una oferta. Cuando confirmen, aparecen acá.
                </p>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[720px]">
                    <thead>
                      <tr className="border-b border-[#2a2a2a]">
                        <th className="py-6 pr-6 label-tech text-[12px] text-[#cfc4c5] font-normal w-16">
                          #
                        </th>
                        <th className="py-6 px-6 label-tech text-[12px] text-[#cfc4c5] font-normal">
                          Staff
                        </th>
                        <th className="py-6 px-6 label-tech text-[12px] text-[#cfc4c5] font-normal">
                          Evento
                        </th>
                        <th className="py-6 px-6 label-tech text-[12px] text-[#cfc4c5] font-normal text-right">
                          Monto
                        </th>
                        <th className="py-6 pl-6 label-tech text-[12px] text-[#cfc4c5] font-normal text-right">
                          Fecha
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-[18px]">
                      {roster.map((o, i) => {
                        const nombre =
                          [o.staff_nombre, o.staff_apellido].filter(Boolean).join(" ").trim() ||
                          "Sin nombre";
                        return (
                          <tr
                            key={o.id}
                            className="border-b border-[#2a2a2a] hover:bg-[#0e0e0e] transition-colors group"
                          >
                            <td className="py-6 pr-6 text-[#cfc4c5]">
                              {String(i + 1).padStart(2, "0")}
                            </td>
                            <td className="py-6 px-6 text-[#e5e2e1] font-medium group-hover:text-[#b9c3ff] transition-colors uppercase">
                              {nombre}
                            </td>
                            <td className="py-6 px-6 text-[#cfc4c5]">
                              {(o.gig_title ?? "").trim() || "Sin evento"}
                            </td>
                            <td className="py-6 px-6 text-[#e5e2e1] text-right">
                              {o.amount != null ? money.format(Number(o.amount)) : "—"}
                            </td>
                            <td className="py-6 pl-6 text-[#cfc4c5] text-right">
                              {o.responded_at
                                ? new Date(o.responded_at).toLocaleDateString("es-AR")
                                : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="w-full px-6 md:px-20 py-6 flex flex-col md:flex-row justify-between items-center border-t border-[#4c4546] bg-[#131313] mt-24 md:mt-40">
        <div className="label-tech text-[12px] text-[#cfc4c5] mb-4 md:mb-0 normal-case tracking-[0.1em]">
          LABURO // Análisis de operaciones
        </div>
        <div className="flex gap-6">
          <Link
            href="/tablero"
            className="label-tech text-[12px] text-[#cfc4c5] hover:text-[#e5e2e1] transition-colors"
          >
            Eventos
          </Link>
          <Link
            href="/buscar"
            className="label-tech text-[12px] text-[#cfc4c5] hover:text-[#e5e2e1] transition-colors"
          >
            Buscar staff
          </Link>
        </div>
      </footer>
    </div>
  );
}
