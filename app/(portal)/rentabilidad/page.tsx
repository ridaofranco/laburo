/**
 * Rentabilidad: cuánto gana la productora con sus eventos. DATOS REALES y
 * HONESTOS, cada número sale de las ofertas y los eventos del org
 * (RLS-scopeado). Nada inventado: sin ofertas, muestra estado vacío. El
 * bar-chart es real (ofertas/mes).
 *
 * ── POR QUÉ EL MARGEN ES LO PRIMERO Y MÁS GRANDE (31/7) ─────────────────────
 * Esta pantalla era el "Yield Analysis" de Stitch: la métrica dominante, a
 * 120px, era la TASA DE ACEPTACIÓN de ofertas. Eso es una métrica de
 * reclutamiento y no contesta lo que una productora viene a preguntar acá, que
 * es cuánto gana. Se reordenó el bento: el margen pasa a ser el número héroe,
 * con el ingreso y el costo al lado como cifras de apoyo, y la tasa de
 * aceptación y las ofertas por mes bajan a métricas secundarias.
 *
 * No cambió ni una query ni un cálculo: los números ya eran reales. Es
 * reordenamiento y copy.
 *
 * Server component. El layout del portal ya pone el sidebar + <main>.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { TrendingUp, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { orgActual } from "@/lib/org";
import { ExportCsvButton, type CsvRow } from "./export-csv-button";
import { fmtFecha } from "@/lib/dates";
import { money, moneyCompact } from "@/lib/format";
import { LoadError } from "@/components/load-error";

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


export default async function RentabilidadPage() {
  // ── EL GATE, y va acá y no solo en el menú (3/8, rehecho el 6/8) ──────────
  // Franco: "eso es interno mío". Sacarlo del sidebar es cosmético: la URL se
  // escribe a mano. `notFound()` y no un cartel de "no tenés permiso", igual que
  // en /leads: para una productora cliente esta pantalla directamente no existe,
  // y avisarle que existe pero no la puede ver es contarle de más.
  //
  // NO hubo fuga de datos antes de esto: las vistas son `security_invoker`, así
  // que cada productora veía sus propios números, no los de SOMOS DER. El
  // problema era mostrarle una pantalla del negocio que no es suya.
  const org = await orgActual();
  if (!org?.esPlataforma) notFound();

  const supabase = await createClient();

  const { data, error } = await supabase
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

  // Margen = lo que le cobrás al cliente (suma de client_budget de los gigs)
  // menos el costo del staff confirmado (monto comprometido). Tu ganancia.
  const { data: gigsData } = await supabase.from("staff_app_gigs").select("client_budget");
  const totalIngreso = (gigsData ?? []).reduce(
    (s, g) => s + (Number((g as { client_budget: number | null }).client_budget) || 0),
    0,
  );
  const tieneIngreso = totalIngreso > 0;
  const margen = totalIngreso - montoComprometido;

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
    monto: o.amount != null ? money(Number(o.amount)) : "",
    fecha: fmtFecha(o.responded_at, {}) ?? "",
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
            <h2 className="t-display text-[#e5e2e1] uppercase break-words">
              Tu
              <br />
              Rentabilidad
            </h2>
            <p className="label-tech text-[12px] text-[#cfc4c5] mb-2 shrink-0">
              Ingreso, costo y margen
            </p>
          </div>
          <p className="text-[16px] leading-[1.6] text-[#cfc4c5] max-w-[560px]">
            Cuánto ganás con tus eventos: lo que le cobrás al cliente menos lo
            que te cuesta el staff.
          </p>
        </section>

        {error ? (
          <LoadError what="la rentabilidad" />
        ) : sinDatos ? (
          <div className="border border-[#2a2a2a] bg-[#0e0e0e] p-12 md:p-20 text-center">
            <p className="text-[16px] text-[#cfc4c5] max-w-[460px] mx-auto">
              Todavía no hay ofertas para analizar. Cuando empieces a enviar
              ofertas y a confirmar staff, acá vas a ver tu margen, lo que te
              cuesta el equipo y la tasa de aceptación de tus ofertas.
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
            {/* ── LO QUE GANÁS. Es el bloque grande porque es la pregunta que
                trae a la productora a esta pantalla. Con el ingreso y el costo
                al lado como cifras de apoyo. ── */}
            {tieneIngreso ? (
              <section className="grid grid-cols-1 md:grid-cols-12 gap-8">
                <div
                  className={`md:col-span-8 bg-[#0e0e0e] border p-6 flex flex-col justify-between min-h-[400px] transition-colors duration-150 ${
                    margen >= 0 ? "border-[#3dd68c]/40" : "border-[#ffb4ab]/40"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="label-tech text-[12px] text-[#cfc4c5]">Tu margen</span>
                    <TrendingUp size={24} className="text-[#b9c3ff] shrink-0" />
                  </div>
                  <div>
                    <div className={`t-stat ${margen >= 0 ? "text-[#3dd68c]" : "text-[#ffb4ab]"}`}>
                      {moneyCompact(margen)}
                    </div>
                    <div className="text-[16px] leading-[1.6] text-[#cfc4c5] mt-4 max-w-[448px]">
                      {margen >= 0
                        ? "Lo que te queda después de pagarle al staff que ya confirmó."
                        : "Hoy estás poniendo plata: el staff confirmado cuesta más de lo que cargaste como ingreso."}
                    </div>
                  </div>
                </div>

                <div className="md:col-span-4 flex flex-col gap-8">
                  <div className="bg-[#0e0e0e] border border-[#2a2a2a] p-6 flex-1 flex flex-col justify-between">
                    <span className="label-tech text-[12px] text-[#cfc4c5] block mb-4">
                      Lo que cobrás al cliente
                    </span>
                    <div className="t-stat-sm text-[#e5e2e1]">{moneyCompact(totalIngreso)}</div>
                  </div>
                  <div className="bg-[#0e0e0e] border border-[#2a2a2a] p-6 flex-1 flex flex-col justify-between">
                    <span className="label-tech text-[12px] text-[#cfc4c5] block mb-4">
                      Lo que te cuesta el staff
                    </span>
                    <div className="t-stat-sm text-[#cfc4c5]">{moneyCompact(montoComprometido)}</div>
                  </div>
                </div>
              </section>
            ) : (
              // Estado vacío honesto, tal cual estaba: ya hablaba en la voz
              // correcta y explica exactamente qué hacer para desbloquearlo.
              <section className="border border-[#2a2a2a] bg-[#0e0e0e] p-6">
                <p className="text-[15px] text-[#cfc4c5] leading-[1.6] max-w-[560px]">
                  Cargá el <span className="text-[#e5e2e1]">ingreso del cliente</span> en cada evento
                  (desde el tablero, al crear o editar) y acá te calculo tu margen real: lo que cobrás
                  menos el costo del staff.
                </p>
                <p className="text-[15px] text-[#cfc4c5] leading-[1.6] max-w-[560px] mt-4">
                  Mientras tanto, lo que ya tenés comprometido con el staff son{" "}
                  <span className="text-[#e5e2e1]">{moneyCompact(montoComprometido)}</span>.
                </p>
              </section>
            )}

            {/* ── Métricas secundarias: cómo viene el reclutamiento. Bajaron de
                tamaño a propósito: son de reclutamiento, no contestan cuánto
                gana. ── */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-[#0e0e0e] border border-[#2a2a2a] p-6 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="label-tech text-[12px] text-[#cfc4c5]">
                    Tasa de aceptación
                  </span>
                </div>
                <div className="mt-8">
                  <div className="t-stat-sm text-[#e5e2e1]">
                    {tasaAceptacion ?? 0}
                    <span className="text-[#cfc4c5]">%</span>
                  </div>
                  <div className="text-[15px] leading-[1.6] text-[#cfc4c5] mt-3 max-w-[448px]">
                    {acceptedCount} de {total}{" "}
                    {total === 1 ? "oferta enviada fue aceptada" : "ofertas enviadas fueron aceptadas"}.
                    El resto sigue abierta, vista o vencida.
                  </div>
                </div>
              </div>

              <div className="bg-[#0e0e0e] border border-[#2a2a2a] p-6 flex flex-col justify-between">
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
              </div>
            </section>

            {/* Tabla staff confirmado */}
            <section className="flex flex-col gap-6">
              <div className="border-b border-[#2a2a2a] pb-2 flex justify-between items-end gap-4">
                <h3 className="t-section text-[#e5e2e1] uppercase">
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
                              {o.amount != null ? money(Number(o.amount)) : "—"}
                            </td>
                            <td className="py-6 pl-6 text-[#cfc4c5] text-right">
                              {fmtFecha(o.responded_at, {}) ?? "—"}
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
          LABURO // Tu rentabilidad
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
