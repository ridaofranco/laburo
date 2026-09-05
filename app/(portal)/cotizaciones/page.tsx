/**
 * /cotizaciones — la lista de pedidos de precio (etapa 2 de LICITACIONES.md).
 *
 * La lista muestra "3 de 12 cotizaron" y el mejor precio, porque es lo único
 * que dice de un vistazo si el pedido está yendo bien o hay que salir a
 * recordar. Un listado de títulos y fechas no sirve para decidir nada.
 */

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { listarPedidos } from "./actions";
import { fmtMonto } from "@/lib/cotizaciones";
import { fmtFechaHora } from "@/lib/dates";

export const metadata: Metadata = {
  title: "LABURO. | Pedidos de precio",
};

function Estado({ estado, cerrado }: { estado: string; cerrado: boolean }) {
  const texto =
    estado === "adjudicada"
      ? "Adjudicado"
      : estado === "cancelada"
        ? "Cancelado"
        : cerrado
          ? "Cerrado"
          : "Abierto";
  const color =
    estado === "adjudicada"
      ? "text-[#7ee787] border-[#7ee787]/30"
      : estado === "cancelada"
        ? "text-[#cfc4c5] border-[#333]"
        : cerrado
          ? "text-[#e5c07b] border-[#e5c07b]/30"
          : "text-[#6b9fff] border-[#6b9fff]/30";
  return (
    <span className={`text-[12px] uppercase tracking-[0.12em] border px-2 py-1 ${color}`}>
      {texto}
    </span>
  );
}

export default async function CotizacionesPage() {
  const pedidos = await listarPedidos();

  return (
    <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-10 md:py-16 flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <p className="label-tech text-[12px] uppercase tracking-[0.2em] text-[#c6c6c6]">
          Pedidos de precio
        </p>
        <h1 className="t-display text-[#e5e2e1]">
          {pedidos.length === 0
            ? "Pedir precio a varios"
            : pedidos.length === 1
              ? "1 pedido"
              : `${pedidos.length} pedidos`}
        </h1>
        <p className="text-[16px] text-[#cfc4c5] leading-[1.6] max-w-[640px] mt-1">
          Le pedís precio a varias empresas por lo mismo y al mismo tiempo, y las
          comparás en una tabla. Cada una carga su presupuesto sin ver lo que
          cotizaron las otras, y no necesita tener cuenta.
        </p>
        <div className="mt-2">
          <Link
            href="/cotizaciones/nuevo"
            className="inline-flex items-center justify-center min-h-[44px] px-6 bg-[#0047FF] text-white text-[15px] font-semibold"
          >
            Nuevo pedido
          </Link>
        </div>
      </header>

      {pedidos.length === 0 ? (
        <div className="border border-[#222] bg-[#0A0A0A] p-8 flex flex-col gap-3">
          <p className="text-[18px] text-[#e5e2e1]">Todavía no pediste ningún precio.</p>
          <p className="text-[15px] text-[#cfc4c5] leading-[1.6] max-w-[560px]">
            Sirve para cuando tenés que preguntarle lo mismo a diez empresas: en vez de
            diez mails y una planilla a mano, armás el pedido una vez, pegás la lista de
            correos y las respuestas entran ordenadas por precio.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {pedidos.map((p) => (
            <li key={p.id}>
              <Link
                href={`/cotizaciones/${p.id}`}
                className="block border border-[#222] bg-[#0A0A0A] p-5 hover:border-[#0047FF] transition-colors"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-[18px] text-[#e5e2e1] truncate">{p.titulo}</span>
                    <span className="text-[14px] text-[#8A8A8A]">
                      {p.categoria ? `${p.categoria} · ` : ""}
                      {p.cerrado ? "cerró el " : "cierra el "}
                      {fmtFechaHora(p.cierra_at, {
                        day: "2-digit",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <Estado estado={p.estado} cerrado={p.cerrado} />
                </div>

                <div className="flex flex-wrap gap-x-8 gap-y-2 mt-4 text-[14px]">
                  <span className="text-[#cfc4c5]">
                    <strong className="text-[#e5e2e1]">
                      {p.cotizaron} de {p.invitados}
                    </strong>{" "}
                    cotizaron
                  </span>
                  {p.mejor != null ? (
                    <span className="text-[#cfc4c5]">
                      Más barato: <strong className="text-[#e5e2e1]">{fmtMonto(p.mejor)}</strong>
                    </span>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
