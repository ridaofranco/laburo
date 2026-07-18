/**
 * Pagos (informativo) — DATOS REALES. Decisión v1 cerrada: "pagos solo
 * informativos": LABURO NO procesa plata (cero-costo, sin MercadoPago), así que
 * esta pantalla es la referencia de lo que Franco tiene comprometido con el staff
 * que ya confirmó. Deriva de las ofertas aceptadas (staff_app_offers, RLS): monto
 * por persona/evento + total comprometido. Sin botones falsos "Aprobar/Liquidar"
 * (implicaban un sistema de pago que no existe). Server component. Estilos Stitch.
 *
 * El mockup de Stitch traía totales inventados ($42,500 / $128,400) y filas
 * falsas ("Main Stage Rigging", "VFX Studio"): reemplazados por lo real.
 */

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtFecha } from "@/lib/dates";

interface OfferRow {
  id: string;
  amount: number | null;
  status: string | null;
  responded_at: string | null;
  sent_at: string | null;
  gig_title: string | null;
  staff_nombre: string | null;
  staff_apellido: string | null;
}

const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function compact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `$${Math.round(n / 1000)}K`;
  return money.format(n);
}

function fecha(iso: string | null): string {
  return fmtFecha(iso, {}) ?? "—";
}

export default async function PagosPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("staff_app_offers")
    .select("id,amount,status,responded_at,sent_at,gig_title,staff_nombre,staff_apellido")
    .eq("status", "accepted");

  const rows = (data ?? []) as OfferRow[];
  rows.sort((a, b) => {
    const ta = a.responded_at ? new Date(a.responded_at).getTime() : 0;
    const tb = b.responded_at ? new Date(b.responded_at).getTime() : 0;
    return tb - ta;
  });

  const totalComprometido = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const conMonto = rows.filter((r) => r.amount != null && Number(r.amount) > 0).length;

  return (
    <div className="max-w-[1440px] mx-auto w-full px-6 md:px-20 py-16 md:py-24">
      {/* Title */}
      <div className="mb-8">
        <h2 className="font-[family-name:var(--font-syne)] text-[40px] md:text-[64px] font-bold text-[#c6c6c6] leading-[1.1] tracking-[-0.02em]">
          Pagos
        </h2>
        <p className="text-[16px] text-[#cfc4c5] mt-4 max-w-[620px] leading-[1.6]">
          Referencia informativa de lo que tenés comprometido con el staff que ya
          confirmó. LABURO no procesa pagos: coordinás y pagás como siempre, esto
          es tu resumen.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="border-t border-b border-[#4c4546] py-20 text-center mt-12">
          <p className="text-[16px] text-[#cfc4c5] max-w-[440px] mx-auto">
            Todavía no hay staff confirmado con un monto. Cuando alguien acepte una
            oferta con pago, aparece acá el resumen.
          </p>
          <Link
            href="/buscar"
            className="mt-6 inline-block label-tech text-[12px] text-[#e5e2e1] hover:opacity-70 border-b border-[#4c4546] pb-1"
          >
            Buscar staff
          </Link>
        </div>
      ) : (
        <>
          {/* Totales reales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-24 mt-8">
            <div className="flex flex-col gap-2 p-6 border border-[#4c4546] bg-[#131313]">
              <span className="label-tech text-[12px] text-[#cfc4c5]">
                Total comprometido
              </span>
              <span className="font-[family-name:var(--font-syne)] text-[64px] md:text-[120px] font-extrabold text-[#c6c6c6] leading-[1.1] tracking-[-0.04em]">
                {compact(totalComprometido)}
              </span>
            </div>
            <div className="flex flex-col gap-2 p-6 border border-[#4c4546] bg-[#131313]">
              <span className="label-tech text-[12px] text-[#cfc4c5]">
                Staff confirmado
              </span>
              <span className="font-[family-name:var(--font-syne)] text-[64px] md:text-[120px] font-extrabold text-[#c6c6c6] leading-[1.1] tracking-[-0.04em]">
                {rows.length}
              </span>
              <span className="text-[13px] text-[#cfc4c5]">
                {conMonto} con monto cargado
              </span>
            </div>
          </div>

          {/* Detalle real */}
          <section>
            <div className="flex items-baseline justify-between border-b border-[#4c4546] pb-6 mb-8">
              <h3 className="font-[family-name:var(--font-syne)] text-[28px] md:text-[32px] font-semibold text-[#c6c6c6] leading-[1.2] tracking-[-0.01em]">
                Detalle por confirmación
              </h3>
              <span className="label-tech text-[12px] text-[#cfc4c5]">Informativo</span>
            </div>
            <div className="flex flex-col gap-0">
              <div className="hidden md:grid grid-cols-12 gap-4 pb-4 border-b border-[#4c4546] text-[#cfc4c5] label-tech text-[12px]">
                <div className="col-span-2">Confirmado</div>
                <div className="col-span-4">Staff</div>
                <div className="col-span-4">Evento</div>
                <div className="col-span-2 text-right">Monto</div>
              </div>
              {rows.map((r) => {
                const nombre =
                  [r.staff_nombre, r.staff_apellido].filter(Boolean).join(" ").trim() ||
                  "Sin nombre";
                return (
                  <div
                    key={r.id}
                    className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 py-6 border-b border-[#4c4546] items-center"
                  >
                    <div className="col-span-2 text-[15px] text-[#cfc4c5]">
                      {fecha(r.responded_at)}
                    </div>
                    <div className="col-span-4 text-[18px] text-[#c6c6c6] uppercase font-[family-name:var(--font-syne)] font-semibold">
                      {nombre}
                    </div>
                    <div className="col-span-4 text-[16px] text-[#cfc4c5]">
                      {(r.gig_title ?? "").trim() || "Sin evento"}
                    </div>
                    <div className="col-span-2 text-left md:text-right text-[18px] text-[#e5e2e1]">
                      {r.amount != null && Number(r.amount) > 0
                        ? money.format(Number(r.amount))
                        : "A convenir"}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
