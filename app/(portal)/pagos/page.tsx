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
import { money, moneyCompact } from "@/lib/format";
import { LoadError } from "@/components/load-error";
import { PagoListoBoton } from "./pago-listo-boton";

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


function fecha(iso: string | null): string {
  return fmtFecha(iso, {}) ?? "—";
}

function estadoCobro(s: string | null): { label: string; cls: string } {
  if (s === "approved") return { label: "Aprobado", cls: "text-[#3dd68c]" };
  if (s === "rejected" || s === "cancelled") return { label: "Rechazado", cls: "text-[#ffb4ab]" };
  if (s === "pending" || s === "in_process") return { label: "Pendiente", cls: "text-[#f5a623]" };
  return { label: s ?? "—", cls: "text-[#cfc4c5]" };
}

interface CobroRow {
  id: string;
  gig_title: string | null;
  amount: number | null;
  status: string | null;
  created_at: string;
}

export default async function PagosPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
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

  // Estado "pago avisado" por oferta (offers.pago_listo_at, migración 0032).
  // QUERY APARTE Y TOLERANTE a propósito: hasta que la 0032 se aplique, la
  // columna no existe en la vista y este select falla. Si fuera parte del select
  // principal, tiraría abajo TODA la pantalla de pagos; así, solo faltan los
  // estados y el botón contesta honesto al apretar.
  const avisadoPor = new Map<string, boolean>();
  const { data: avisosData } = await supabase
    .from("staff_app_offers")
    .select("id,pago_listo_at")
    .eq("status", "accepted");
  for (const a of (avisosData ?? []) as Array<{ id: string; pago_listo_at: string | null }>) {
    avisadoPor.set(a.id, !!a.pago_listo_at);
  }

  // Panel de cobros al cliente (cada intento de pago por MercadoPago).
  const { data: cobrosData } = await supabase
    .from("staff_app_client_payment_events")
    .select("id,gig_title,amount,status,created_at")
    .order("created_at", { ascending: false });
  const cobros = (cobrosData ?? []) as CobroRow[];

  return (
    <div className="max-w-[1440px] mx-auto w-full px-6 md:px-20 py-16 md:py-24">
      {/* Title */}
      <div className="mb-8">
        <h2 className="t-display text-[#c6c6c6]">
          Pagos
        </h2>
        <p className="text-[16px] text-[#cfc4c5] mt-4 max-w-[620px] leading-[1.6]">
          Referencia informativa de lo que tenés comprometido con el staff que ya
          confirmó. LABURO no procesa pagos: coordinás y pagás como siempre, esto
          es tu resumen.
        </p>
      </div>

      {/* Panel de cobros al cliente: cada intento de pago por MercadoPago */}
      {cobros.length > 0 && (
        <section className="mb-16 border border-[#2a2a2a] bg-[#0e0e0e]">
          <div className="px-6 py-5 border-b border-[#2a2a2a]">
            <h3 className="t-section text-[#e5e2e1] uppercase">
              Cobros al cliente
            </h3>
            <p className="text-[13px] text-[#8a8a8a] mt-1">
              Cada intento de pago por MercadoPago y cómo salió. Se actualiza solo, no tenés que preguntar.
            </p>
          </div>
          <ul className="flex flex-col">
            {cobros.map((c) => {
              const e = estadoCobro(c.status);
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#1A1A1A] last:border-0"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-[15px] text-[#e5e2e1] truncate">
                      {(c.gig_title ?? "").trim() || "Evento"}
                    </span>
                    <span className="label-tech text-[11px] text-[#8a8a8a]">{fecha(c.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-6 shrink-0">
                    <span className="text-[15px] text-[#cfc4c5]">
                      {c.amount != null ? money(Number(c.amount)) : "—"}
                    </span>
                    <span className={`label-tech text-[12px] w-[80px] text-right ${e.cls}`}>{e.label}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {error ? (
        <div className="mt-12">
          <LoadError what="los pagos" />
        </div>
      ) : rows.length === 0 ? (
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
              <span className="t-stat text-[#c6c6c6]">
                {moneyCompact(totalComprometido)}
              </span>
            </div>
            <div className="flex flex-col gap-2 p-6 border border-[#4c4546] bg-[#131313]">
              <span className="label-tech text-[12px] text-[#cfc4c5]">
                Staff confirmado
              </span>
              <span className="t-stat text-[#c6c6c6]">
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
              <h3 className="t-section text-[#c6c6c6]">
                Detalle por confirmación
              </h3>
              <span className="label-tech text-[12px] text-[#cfc4c5]">Informativo</span>
            </div>
            <div className="flex flex-col gap-0">
              <div className="hidden md:grid grid-cols-12 gap-4 pb-4 border-b border-[#4c4546] text-[#cfc4c5] label-tech text-[12px]">
                <div className="col-span-2">Confirmado</div>
                <div className="col-span-3">Staff</div>
                <div className="col-span-3">Evento</div>
                <div className="col-span-2 text-right">Monto</div>
                <div className="col-span-2 text-right">Aviso de pago</div>
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
                    <div className="col-span-3 text-[18px] text-[#c6c6c6] uppercase font-[family-name:var(--font-syne)] font-semibold">
                      {nombre}
                    </div>
                    <div className="col-span-3 text-[16px] text-[#cfc4c5]">
                      {(r.gig_title ?? "").trim() || "Sin evento"}
                    </div>
                    <div className="col-span-2 text-left md:text-right text-[18px] text-[#e5e2e1]">
                      {r.amount != null && Number(r.amount) > 0
                        ? money(Number(r.amount))
                        : "A convenir"}
                    </div>
                    <div className="col-span-2 text-left md:text-right">
                      <PagoListoBoton
                        offerId={r.id}
                        yaAvisado={avisadoPor.get(r.id) ?? false}
                      />
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
