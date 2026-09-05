"use client";

/**
 * La pantalla del pedido: invitar, comparar y elegir.
 *
 * ── LA TABLA COMPARATIVA, Y POR QUÉ NO ES SOLO PRECIOS ──────────────────────
 * Ordena por monto, pero muestra SIEMPRE al lado qué incluye y qué no. Un precio
 * suelto no se puede comparar: uno trae seguro, otro lo cobra por bulto. Una
 * tabla que solo ordena números miente, y hace elegir mal.
 *
 * ── Y POR QUÉ NO HAY "ADJUDICAR AL MÁS BARATO" ─────────────────────────────
 * Porque el más barato no es el que gana: gana el que incluye lo que hay que
 * incluir. La tabla ordena; elegir lo hace una persona, con un botón por fila.
 *
 * ── LOS QUE NO COTIZARON SE MUESTRAN IGUAL ─────────────────────────────────
 * Con su estado real: si el mail no salió, si no lo abrió, o si lo abrió y no
 * cargó nada. Son tres problemas distintos con tres soluciones distintas, y
 * esconderlos deja la sensación de que "nadie contestó" cuando en realidad
 * puede ser que el mail nunca haya salido.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { invitar, adjudicar, cerrarPedido } from "../actions";
import type { PedidoDetalle, CotizacionFila, InvitadoSinCotizar } from "../actions";
import { parsearInvitados, fmtMonto } from "@/lib/cotizaciones";
import { fmtFecha, fmtFechaHora } from "@/lib/dates";

const inputCaja =
  "w-full min-h-[48px] bg-[#121212] border border-[#2a2a2a] focus:border-[#e5e2e1] outline-none text-[16px] text-[#e5e2e1] px-4 py-3 rounded-none transition-colors [color-scheme:dark]";
const labelCls = "label-tech text-[11px] uppercase tracking-widest text-[#cfc4c5]";

export function PedidoClient({
  pedido,
  cotizaciones,
  sinCotizar,
}: {
  pedido: PedidoDetalle;
  cotizaciones: CotizacionFila[];
  sinCotizar: InvitadoSinCotizar[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lista, setLista] = useState("");
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const abierto = pedido.estado === "abierta" && !pedido.cerrado;
  const adjudicado = pedido.estado === "adjudicada";

  const previa = parsearInvitados(lista);

  function mandarInvitaciones() {
    if (previa.invitados.length === 0) {
      toast.error("Pegá al menos un mail.");
      return;
    }
    startTransition(async () => {
      const r = await invitar(pedido.id, previa.invitados);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setLista("");
      // Se dice exactamente qué pasó, incluido lo que no salió. Un "listo" con
      // tres mails caídos adentro es la forma más cara de mentir acá.
      const partes = [`${r.enviados} ${r.enviados === 1 ? "invitación enviada" : "invitaciones enviadas"}`];
      if (r.repetidos) partes.push(`${r.repetidos} ya estaban invitados`);
      if (r.fallados) partes.push(`${r.fallados} no salieron`);
      if (r.fallados) toast.warning(partes.join(" · "));
      else toast.success(partes.join(" · "));
      router.refresh();
    });
  }

  function elegir(quoteId: string) {
    startTransition(async () => {
      const r = await adjudicar(pedido.id, quoteId);
      if (!r.ok) {
        toast.error(r.error);
        setConfirmando(null);
        return;
      }
      toast.success(
        r.fallados
          ? `Adjudicado. ${r.avisados} avisados, ${r.fallados} sin avisar.`
          : `Adjudicado y avisados los ${r.avisados}.`,
      );
      setConfirmando(null);
      router.refresh();
    });
  }

  function cerrar(cancelar: boolean) {
    startTransition(async () => {
      const r = await cerrarPedido(pedido.id, cancelar);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(cancelar ? "Pedido cancelado." : "Pedido cerrado.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-10">
      {/* ── El pedido ───────────────────────────────────────────────── */}
      <section className="border border-[#222] bg-[#0A0A0A] p-6 flex flex-col gap-4">
        <div className="flex flex-wrap gap-x-10 gap-y-3 text-[15px]">
          <Dato label="Estado" valor={
            adjudicado ? "Adjudicado"
              : pedido.estado === "cancelada" ? "Cancelado"
              : pedido.cerrado ? "Cerrado" : "Abierto"
          } />
          <Dato label="Rubro" valor={pedido.categoria} />
          <Dato
            label="Dónde"
            valor={[pedido.ciudad, pedido.provincia].filter(Boolean).join(", ") || null}
          />
          <Dato
            label="Para cuándo"
            valor={pedido.necesario_para ? fmtFecha(pedido.necesario_para, { day: "2-digit", month: "long", year: "numeric" }) : null}
          />
          <Dato
            label={pedido.cerrado ? "Cerró" : "Cierra"}
            valor={fmtFechaHora(pedido.cierra_at, {
              weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit",
            })}
          />
        </div>

        {pedido.descripcion ? (
          <p className="text-[15px] text-[#cfc4c5] leading-[1.6] whitespace-pre-line border-l-2 border-[#4c4546] pl-4">
            {pedido.descripcion}
          </p>
        ) : null}

        {pedido.campos.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className={labelCls}>Lo que se les pide detallar</p>
            <ul className="flex flex-col gap-1">
              {pedido.campos.map((c) => (
                <li key={c.clave} className="text-[14px] text-[#cfc4c5]">
                  · {c.etiqueta}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {abierto ? (
          <div className="flex flex-wrap gap-4 pt-2">
            <button
              type="button"
              onClick={() => cerrar(false)}
              disabled={pending}
              className="min-h-[44px] px-5 border border-[#2a2a2a] text-[14px] text-[#cfc4c5] hover:border-[#e5e2e1] hover:text-[#e5e2e1] transition-colors disabled:opacity-50"
            >
              Cerrar antes de tiempo
            </button>
            <button
              type="button"
              onClick={() => cerrar(true)}
              disabled={pending}
              className="min-h-[44px] px-5 border border-[#2a2a2a] text-[14px] text-[#8A8A8A] hover:border-[#e5e2e1] hover:text-[#e5e2e1] transition-colors disabled:opacity-50"
            >
              Cancelar el pedido
            </button>
          </div>
        ) : null}
      </section>

      {/* ── Invitar ─────────────────────────────────────────────────── */}
      {abierto ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-[20px] text-[#e5e2e1]">A quién le pedís precio</h2>
            <p className="text-[15px] text-[#cfc4c5] leading-[1.6] max-w-[680px]">
              Pegá los mails, uno por línea o separados por coma. No hace falta que estén
              registrados en LABURO: a cada uno le llega su propio link y carga el
              presupuesto sin crear cuenta. Se acepta el formato{" "}
              <span className="text-[#e5e2e1]">Nombre &lt;mail@empresa.com&gt;</span>.
            </p>
          </div>

          <label className="flex flex-col gap-2">
            <span className={labelCls}>Mails</span>
            <textarea
              className={`${inputCaja} min-h-[140px] font-mono text-[14px]`}
              value={lista}
              onChange={(e) => setLista(e.target.value)}
              placeholder={"ventas@transportes.com\nLogística Sur <info@logisticasur.com>\ncontacto@fletes.com.ar"}
            />
          </label>

          {lista.trim() ? (
            <p className="text-[14px] text-[#cfc4c5]">
              {previa.invitados.length} para invitar
              {previa.repetidos ? ` · ${previa.repetidos} repetidos en la lista` : ""}
              {previa.invalidos.length
                ? ` · ${previa.invalidos.length} no parecen mails: ${previa.invalidos.slice(0, 3).join(", ")}`
                : ""}
            </p>
          ) : null}

          <button
            type="button"
            onClick={mandarInvitaciones}
            disabled={pending || previa.invitados.length === 0}
            className="self-start min-h-[48px] px-8 bg-[#0047FF] text-white text-[15px] font-semibold disabled:opacity-50"
          >
            {pending ? "Mandando..." : "Mandar las invitaciones"}
          </button>
        </section>
      ) : null}

      {/* ── La comparación ──────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-[20px] text-[#e5e2e1]">
            {cotizaciones.length === 0
              ? "Todavía no llegó ningún presupuesto"
              : cotizaciones.length === 1
                ? "1 presupuesto"
                : `${cotizaciones.length} presupuestos`}
          </h2>
          {cotizaciones.length > 1 ? (
            <p className="text-[15px] text-[#cfc4c5] leading-[1.6]">
              Ordenados de más barato a más caro. Mirá qué incluye cada uno antes de
              elegir: el más barato no siempre es el que conviene.
            </p>
          ) : null}
        </div>

        {cotizaciones.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-[#222]">
                  <Th>Proveedor</Th>
                  <Th>Precio</Th>
                  <Th>Incluye</Th>
                  <Th>No incluye</Th>
                  <Th>Vale</Th>
                  <Th> </Th>
                </tr>
              </thead>
              <tbody>
                {cotizaciones.map((c) => (
                  <tr
                    key={c.quote_id}
                    className={`border-b border-[#1A1A1A] align-top ${
                      c.estado === "ganadora" ? "bg-[#0d1a0d]" : ""
                    }`}
                  >
                    <Td>
                      <span className="text-[#e5e2e1]">{c.proveedor}</span>
                      {c.estado === "ganadora" ? (
                        <span className="block text-[12px] uppercase tracking-[0.12em] text-[#7ee787] mt-1">
                          Elegido
                        </span>
                      ) : null}
                      {c.estado === "no_elegida" ? (
                        <span className="block text-[12px] uppercase tracking-[0.12em] text-[#8A8A8A] mt-1">
                          No elegido
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <span className="text-[18px] text-[#e5e2e1]">
                        {fmtMonto(c.monto, c.moneda)}
                      </span>
                    </Td>
                    <Td>{c.incluye}</Td>
                    <Td>{c.no_incluye ?? "—"}</Td>
                    <Td>{c.validez_dias ? `${c.validez_dias} días` : "—"}</Td>
                    <Td>
                      {abierto || (!adjudicado && pedido.estado === "cerrada") ? (
                        confirmando === c.quote_id ? (
                          <div className="flex flex-col gap-2">
                            <span className="text-[13px] text-[#cfc4c5]">
                              Se le avisa a todos y no se puede deshacer.
                            </span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => elegir(c.quote_id)}
                                disabled={pending}
                                className="min-h-[40px] px-4 bg-[#0047FF] text-white text-[14px] font-semibold disabled:opacity-50"
                              >
                                Confirmar
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmando(null)}
                                className="min-h-[40px] px-4 border border-[#2a2a2a] text-[14px] text-[#cfc4c5]"
                              >
                                No
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmando(c.quote_id)}
                            className="min-h-[40px] px-4 border border-[#2a2a2a] text-[14px] text-[#cfc4c5] hover:border-[#0047FF] hover:text-[#e5e2e1] transition-colors whitespace-nowrap"
                          >
                            Elegir este
                          </button>
                        )
                      ) : null}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* El desglose que pidió el pedido, por proveedor. Va abajo de la tabla
            y no adentro: son respuestas largas y meterlas en una celda hace
            ilegible justamente lo que hay que comparar. */}
        {cotizaciones.some((c) => Object.keys(c.respuestas ?? {}).length > 0) ? (
          <div className="flex flex-col gap-5 mt-4">
            <p className={labelCls}>Lo que respondió cada uno</p>
            {cotizaciones.map((c) =>
              Object.keys(c.respuestas ?? {}).length ? (
                <div key={c.quote_id} className="border-l-2 border-[#4c4546] pl-4 flex flex-col gap-2">
                  <span className="text-[15px] text-[#e5e2e1]">{c.proveedor}</span>
                  {pedido.campos.map((campo) => {
                    const v = (c.respuestas ?? {})[campo.clave];
                    if (!v) return null;
                    return (
                      <p key={campo.clave} className="text-[14px] text-[#cfc4c5]">
                        <span className="text-[#8A8A8A]">{campo.etiqueta}: </span>
                        {v}
                      </p>
                    );
                  })}
                </div>
              ) : null,
            )}
          </div>
        ) : null}
      </section>

      {/* ── Los que no cotizaron ────────────────────────────────────── */}
      {sinCotizar.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-[20px] text-[#e5e2e1]">
            {sinCotizar.length === 1
              ? "1 invitado sin cotizar"
              : `${sinCotizar.length} invitados sin cotizar`}
          </h2>
          <ul className="flex flex-col">
            {sinCotizar.map((i) => (
              <li
                key={i.invite_id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-[#1A1A1A]"
              >
                <span className="text-[15px] text-[#e5e2e1]">{i.proveedor}</span>
                <span className="text-[14px] text-[#8A8A8A]">
                  {!i.enviado_at
                    ? "El mail no salió"
                    : i.visto_at
                      ? `Abrió el link el ${fmtFecha(i.visto_at, { day: "2-digit", month: "short" })} y no cargó nada`
                      : "Todavía no abrió el link"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <span className="flex flex-col gap-1">
      <span className={labelCls}>{label}</span>
      <span className="text-[#e5e2e1]">{valor}</span>
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left label-tech text-[11px] uppercase tracking-widest text-[#cfc4c5] py-3 pr-6 font-normal">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="py-4 pr-6 text-[14px] text-[#cfc4c5] max-w-[280px]">{children}</td>;
}
