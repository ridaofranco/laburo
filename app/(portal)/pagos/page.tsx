/**
 * Pagos, con DATOS REALES. Es la referencia de lo que la productora tiene
 * comprometido con el staff que ya le confirmó, más los cobros que le hizo a su
 * cliente. Deriva de las ofertas aceptadas (staff_app_offers, RLS): monto por
 * persona y evento, y el total comprometido. Sin botones falsos de
 * "Aprobar/Liquidar", que implicaban un sistema de pago que no existe.
 *
 * ── DOS PLATA DISTINTAS, Y AHORA SE VEN SEPARADAS (31/7) ────────────────────
 * La pantalla mezclaba sin distinguir lo que a la productora le ENTRA (los
 * cobros a su cliente por MercadoPago) con lo que le SALE (lo comprometido con
 * el staff). Ahora son dos secciones con su encabezado y su bajada.
 *
 * LABURO no procesa el pago al staff: eso lo coordina y lo paga ella como
 * siempre, y esta pantalla es su resumen.
 *
 * ── EL COBRO AL CLIENTE ESTÁ APAGADO, Y LA PANTALLA LO DICE (5/9) ───────────
 * Este header decía que el cobro "ya funciona". Dejó de ser cierto el 2/9,
 * cuando Franco decidió que LABURO es gratis. El circuito de MercadoPago sigue
 * entero (tablero/payment-actions.ts y api/mp/webhook), pero está apagado por
 * bandera.
 *
 * LA FUENTE DE VERDAD ES `lib/cobros.ts`, no esta pantalla: acá se LEE
 * COBRO_AL_CLIENTE_ACTIVO y se muestra COBRO_APAGADO_MOTIVO tal cual. El día
 * que se prenda el cobro, se cambia ese archivo y esta pantalla se entera sola.
 *
 * ⚠️ Y "Lo que cobrás" NO se esconde. Antes se dibujaba solo con
 * `cobros.length > 0`, así que con el cobro apagado la sección desaparecía
 * entera y no había forma de distinguir "todavía no cobré nada" de "esto no
 * existe en este producto". Ahora son tres estados: apagado (lo dice),
 * prendido y vacío (vacío honesto), prendido con cobros (la lista de siempre).
 * Un cobro que existió no se esconde nunca, ni con la bandera apagada.
 *
 * El cobro de plataforma (LABURO le cobra a la productora) NO existe todavía:
 * queda para cuando esté definido el precio. No hay UI preparada, a propósito.
 *
 * Server component.
 */

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtFecha } from "@/lib/dates";
import { money, moneyCompact } from "@/lib/format";
import { LoadError } from "@/components/load-error";
import { COBRO_AL_CLIENTE_ACTIVO, COBRO_APAGADO_MOTIVO } from "@/lib/cobros";
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
          Tu plata en dos columnas: lo que cobrás de tus clientes y lo que le
          debés al staff que ya confirmó. LABURO no procesa el pago al staff:
          coordinás y pagás como siempre, esto es tu resumen.
        </p>
      </div>

      {/* ── LO QUE COBRÁS: la plata que ENTRA. Cada intento de pago por
          MercadoPago de tu cliente y cómo salió.

          La sección se dibuja SIEMPRE. Lo que cambia es lo que muestra adentro,
          y son tres casos distintos que antes se veían todos igual (o sea, no
          se veían): el cobro apagado, el cobro prendido sin cobros todavía, y
          el cobro prendido con cobros. ── */}
      <section className="mb-16">
        <div className="border-b border-[#4c4546] pb-6 mb-8">
          <h3 className="t-section text-[#e5e2e1] uppercase">
            Lo que cobrás
          </h3>
          <p className="text-[15px] text-[#cfc4c5] mt-2 max-w-[620px] leading-[1.6]">
            Lo que te pagan tus clientes por MercadoPago. Cada intento y cómo
            salió, se actualiza solo, no tenés que preguntar.
          </p>
        </div>

        {/* El motivo sale de lib/cobros.ts, no está escrito acá: si mañana se
            prende el cobro, cambia UN archivo y esta pantalla se entera. */}
        {!COBRO_AL_CLIENTE_ACTIVO && (
          <div className="border border-[#2a2a2a] bg-[#0e0e0e] px-6 py-8 mb-8">
            <p className="text-[15px] text-[#cfc4c5] max-w-[620px] leading-[1.6]">
              {COBRO_APAGADO_MOTIVO}
            </p>
          </div>
        )}

        {/* Vacío honesto: el cobro está prendido y todavía no entró ninguno.
            Antes este caso y el de arriba eran la misma nada. */}
        {COBRO_AL_CLIENTE_ACTIVO && cobros.length === 0 && (
          <div className="border border-[#2a2a2a] bg-[#0e0e0e] px-6 py-8">
            <p className="text-[15px] text-[#cfc4c5] max-w-[620px] leading-[1.6]">
              Todavía no te pagó ningún cliente. Cuando cobres desde el tablero,
              cada intento aparece acá con cómo salió.
            </p>
          </div>
        )}

        {/* Los cobros que EXISTIERON se muestran aunque la bandera esté
            apagada. Hoy no puede pasar (hay 0), pero sí después de prender el
            cobro y volver a apagarlo, y esconderle a alguien plata que entró de
            verdad sería peor que el bug que estamos arreglando. */}
        {cobros.length > 0 && (
          <ul className="flex flex-col border border-[#2a2a2a] bg-[#0e0e0e]">
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
        )}
      </section>

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
          {/* ── LO QUE LE DEBÉS AL STAFF: la plata que SALE. ── */}
          <div className="border-b border-[#4c4546] pb-6 mb-8 mt-4">
            <h3 className="t-section text-[#e5e2e1] uppercase">
              Lo que le debés al staff
            </h3>
            <p className="text-[15px] text-[#cfc4c5] mt-2 max-w-[620px] leading-[1.6]">
              Lo que te comprometiste a pagarle a la gente que ya aceptó tu
              oferta. Esto sale de tu bolsillo, no pasa por LABURO.
            </p>
          </div>

          {/* Totales reales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-24">
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
