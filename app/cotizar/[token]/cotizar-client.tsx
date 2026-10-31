"use client";

/**
 * El formulario donde el proveedor deja su número.
 *
 * ── EL PRECIO VA ARRIBA Y GRANDE, Y NO ES ESTÉTICA ──────────────────────────
 * De 45 respuestas al pedido del pallet, 43 no traían precio. Este formulario
 * está ordenado al revés que un formulario normal: primero el número, después
 * qué incluye, y al final lo opcional. Lo que se pide primero es lo que se
 * contesta.
 *
 * ── DOS FORMAS DE CARGARLO, SEGÚN LO QUE HAYA PEDIDO EL OTRO (8/9) ──────────
 * Si el pedido viene partido en ítems, en vez del campo único de precio va la
 * lista, y el TOTAL se calcula solo y se muestra grande arriba: la regla 1
 * sigue en pie, el número sigue siendo lo primero que se ve, solo que ahora se
 * arma sumando.
 *
 * Si el pedido no tiene ítems, esta pantalla es exactamente la de antes. Un
 * pedido de una sola cosa no tiene por qué volverse una planilla.
 *
 * ── "ESTO NO LO HAGO" ES UNA CASILLA, NO UN CAMPO VACÍO ─────────────────────
 * Es la mitad que faltaba: si te piden sonido + luces + tarima y solo hacés
 * sonido, hasta hoy tenías que inventar un total o no cotizar. En el caso del
 * pallet, partir la carga en dos fue lo que destrabó a una empresa que ya había
 * dicho que no.
 *
 * ⚠️ Y es distinto de dejarlo en blanco. En blanco significa "no lo cargué
 * todavía" y así viaja (no se manda la línea). Si los dos se confundieran, el
 * que compara creería que tiene una oferta parcial teniendo una incompleta.
 *
 * ── "QUÉ INCLUYE" ES OBLIGATORIO ────────────────────────────────────────────
 * Porque un precio suelto no se puede comparar: uno trae seguro, otro lo cobra
 * por bulto. Sin esto la tabla del otro lado miente. La base también lo exige.
 *
 * ── SE PUEDE CORREGIR HASTA QUE CIERRE, Y SE DICE ───────────────────────────
 * Saber que el número no queda grabado en piedra es lo que hace que alguien se
 * anime a cargar uno estimado en vez de no cargar nada.
 *
 * ── NO SE MUESTRA NINGUNA SEÑAL DE COMPETENCIA ──────────────────────────────
 * Ni cuántos más fueron invitados, ni si alguien ya cotizó, ni rangos. Eso no
 * viaja desde la base a propósito, y la pantalla no lo inventa.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { guardarYRecargar, useRecuperarGuardado } from "@/lib/recarga-por-version";
import { guardarCotizacion, type LineaAGuardar } from "./actions";
import {
  fmtCantidad,
  fmtMonto,
  montoParaInput,
  parsearMonto,
  type ItemPedido,
  type LineaCotizacion,
} from "@/lib/cotizaciones";

const inputCaja =
  "w-full min-h-[48px] bg-[#121212] border border-[#2a2a2a] focus:border-[#e5e2e1] outline-none text-[16px] text-[#e5e2e1] px-4 py-3 rounded-none transition-colors [color-scheme:dark]";
const labelCls = "label-tech text-[11px] uppercase tracking-widest text-[#cfc4c5]";

export interface CotizacionInicial {
  monto: number;
  moneda: string;
  incluye: string;
  no_incluye: string | null;
  validez_dias: number | null;
  respuestas: Record<string, string>;
  lineas?: LineaCotizacion[] | null;
}

/** Lo que la persona escribió para un ítem, mientras lo escribe. */
interface LineaEnPantalla {
  monto: string;
  no_cotiza: boolean;
  comentario: string;
}

/** Todo lo que se ve en el formulario, para guardarlo si hay que recargar. */
interface EnPantalla {
  monto: string;
  moneda: string;
  incluye: string;
  noIncluye: string;
  validez: string;
  respuestas: Record<string, string>;
  lineas: Record<string, LineaEnPantalla>;
}

const VACIA: LineaEnPantalla = { monto: "", no_cotiza: false, comentario: "" };

export function CotizarForm({
  token,
  campos,
  items,
  inicial,
  productora,
}: {
  token: string;
  campos: { clave: string; etiqueta: string }[];
  items: ItemPedido[];
  inicial: CotizacionInicial | null;
  productora: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const porItems = items.length > 0;

  const [monto, setMonto] = useState(inicial && !porItems ? montoParaInput(inicial.monto) : "");
  const [moneda, setMoneda] = useState(inicial?.moneda ?? "ARS");
  const [incluye, setIncluye] = useState(inicial?.incluye ?? "");
  const [noIncluye, setNoIncluye] = useState(inicial?.no_incluye ?? "");
  const [validez, setValidez] = useState(inicial?.validez_dias ? String(inicial.validez_dias) : "");
  const [respuestas, setRespuestas] = useState<Record<string, string>>(
    inicial?.respuestas ?? {},
  );

  // Lo que ya había cargado, indexado por ítem. Un ítem sin línea guardada
  // arranca en blanco, que es lo que significa "todavía no lo cargué".
  const [lineas, setLineas] = useState<Record<string, LineaEnPantalla>>(() => {
    const inicio: Record<string, LineaEnPantalla> = {};
    for (const l of inicial?.lineas ?? []) {
      inicio[l.item_id] = {
        monto: montoParaInput(l.monto),
        no_cotiza: l.no_cotiza,
        comentario: l.comentario ?? "",
      };
    }
    return inicio;
  });

  // Si se publicó una versión nueva con la página abierta, el envío falla
  // siempre («Failed to find Server Action»): se guarda lo cargado, se recarga
  // una vez y acá se devuelve. Ver lib/recarga-por-version.ts.
  const claveGuardado = `cotizar:${token.slice(0, 16)}`;
  useRecuperarGuardado<EnPantalla>(claveGuardado, (g) => {
    if (g.monto !== undefined) setMonto(g.monto);
    if (g.moneda) setMoneda(g.moneda);
    if (g.incluye !== undefined) setIncluye(g.incluye);
    if (g.noIncluye !== undefined) setNoIncluye(g.noIncluye);
    if (g.validez !== undefined) setValidez(g.validez);
    if (g.respuestas) setRespuestas(g.respuestas);
    if (g.lineas) setLineas(g.lineas);
  });

  function editarLinea(itemId: string, cambio: Partial<LineaEnPantalla>) {
    setLineas((prev) => ({ ...prev, [itemId]: { ...(prev[itemId] ?? VACIA), ...cambio } }));
  }

  /**
   * El total mientras se escribe. Es SOLO para mostrar: el que vale lo calcula
   * la base al guardar (migración 0087). Si el número que ordena la tabla
   * comparativa viniera de acá, podría no ser la suma de lo que se ve abajo.
   */
  const total = useMemo(
    () =>
      items.reduce((acc, it) => {
        const l = lineas[it.id];
        if (!l || l.no_cotiza) return acc;
        return acc + (parsearMonto(l.monto) ?? 0);
      }, 0),
    [items, lineas],
  );

  const cotizados = items.filter((it) => !lineas[it.id]?.no_cotiza && parsearMonto(lineas[it.id]?.monto ?? "")).length;
  const sinCargar = items.filter((it) => {
    const l = lineas[it.id];
    return !l || (!l.no_cotiza && !parsearMonto(l.monto));
  }).length;

  function enviar() {
    if (!incluye.trim()) {
      toast.error("Contá qué incluye ese precio.");
      return;
    }

    // Las líneas que viajan: la que tiene precio y la que dice "no lo hago". La
    // que quedó en blanco NO se manda, y esa ausencia es el dato.
    const paraMandar: LineaAGuardar[] = [];
    if (porItems) {
      for (const it of items) {
        const l = lineas[it.id];
        if (!l) continue;
        if (l.no_cotiza) {
          paraMandar.push({ itemId: it.id, monto: null, noCotiza: true, comentario: l.comentario });
          continue;
        }
        const n = parsearMonto(l.monto);
        if (n) {
          paraMandar.push({ itemId: it.id, monto: n, noCotiza: false, comentario: l.comentario });
        }
      }
    }

    if (porItems && total <= 0) {
      toast.error("Poné el precio de al menos un ítem: sin un número, esto no se puede comparar.");
      return;
    }

    let montoSuelto: number | null = null;
    if (!porItems) {
      montoSuelto = parsearMonto(monto);
      if (!montoSuelto) {
        toast.error("Poné el precio: sin un número, esto no se puede comparar.");
        return;
      }
    }

    startTransition(async () => {
      let r: Awaited<ReturnType<typeof guardarCotizacion>>;
      try {
        r = await guardarCotizacion({
          token,
          monto: montoSuelto,
          incluye,
          noIncluye,
          moneda,
          validezDias: validez ? Number(validez) : null,
          respuestas,
          lineas: paraMandar,
        });
      } catch {
        const enPantalla: EnPantalla = { monto, moneda, incluye, noIncluye, validez, respuestas, lineas };
        if (guardarYRecargar(claveGuardado, enPantalla)) return;
        toast.error("No pudimos mandar el presupuesto. Probá de nuevo en un momento.");
        return;
      }
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(inicial ? "Presupuesto actualizado." : "Presupuesto enviado.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-7">
      {inicial ? (
        <p className="text-[15px] text-[#7ee787] border border-[#7ee787]/30 px-4 py-3">
          Ya mandaste tu presupuesto. Podés corregirlo las veces que quieras hasta que
          cierre.
        </p>
      ) : null}

      {porItems ? (
        /* ── El pedido viene partido: el total arriba, la lista abajo ─────── */
        <>
          <section className="flex flex-col gap-3">
            <div className="flex items-end justify-between gap-4 border border-[#2a2a2a] bg-[#121212] px-4 py-4">
              <div className="flex flex-col gap-1">
                <span className={labelCls}>Tu total</span>
                <span className="text-[13px] text-[#8A8A8A]">
                  {cotizados === 0
                    ? "Se suma solo a medida que cargás precios."
                    : `${cotizados} de ${items.length} ${items.length === 1 ? "ítem" : "ítems"} con precio.`}
                </span>
              </div>
              <span className="text-[28px] font-semibold text-[#e5e2e1] whitespace-nowrap">
                {fmtMonto(total, moneda)}
              </span>
            </div>
            <label className="flex items-center gap-3">
              <span className={labelCls}>Moneda</span>
              <select
                className={`${inputCaja} max-w-[120px]`}
                value={moneda}
                onChange={(e) => setMoneda(e.target.value)}
                aria-label="Moneda"
              >
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </label>
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-[18px] text-[#e5e2e1]">Lo que te piden, renglón por renglón</h2>
              <p className="text-[14px] text-[#8A8A8A] leading-[1.6]">
                Poné el precio de cada uno, con impuestos incluidos si corresponde. Lo
                que no hagas, marcalo: podés cotizar solo una parte y sirve igual.
              </p>
            </div>

            <ul className="flex flex-col gap-4">
              {items.map((it) => {
                const l = lineas[it.id] ?? VACIA;
                const cantidad = fmtCantidad(it);
                return (
                  <li
                    key={it.id}
                    className={`border border-[#2a2a2a] p-4 flex flex-col gap-3 ${
                      l.no_cotiza ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-[16px] text-[#e5e2e1]">
                        {it.titulo}
                        {it.obligatorio ? (
                          <span className="ml-2 text-[11px] uppercase tracking-[0.12em] text-[#e3c77f]">
                            Lo necesitan sí o sí
                          </span>
                        ) : null}
                      </span>
                      {cantidad ? (
                        <span className="text-[14px] text-[#cfc4c5]">{cantidad}</span>
                      ) : null}
                      {it.detalle ? (
                        <span className="text-[14px] text-[#8A8A8A] leading-[1.5] whitespace-pre-line">
                          {it.detalle}
                        </span>
                      ) : null}
                    </div>

                    {l.no_cotiza ? null : (
                      <input
                        inputMode="decimal"
                        className={`${inputCaja} text-[20px] font-semibold`}
                        value={l.monto}
                        onChange={(e) => editarLinea(it.id, { monto: e.target.value })}
                        placeholder="Tu precio"
                        aria-label={`Precio de ${it.titulo}`}
                      />
                    )}

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-5 h-5 accent-[#0047FF]"
                        checked={l.no_cotiza}
                        onChange={(e) =>
                          editarLinea(it.id, { no_cotiza: e.target.checked, monto: "" })
                        }
                      />
                      <span className="text-[14px] text-[#cfc4c5]">Esto no lo hago</span>
                    </label>

                    <input
                      className={`${inputCaja} min-h-[44px] text-[15px]`}
                      value={l.comentario}
                      onChange={(e) => editarLinea(it.id, { comentario: e.target.value })}
                      placeholder="Aclaración, si hace falta"
                      maxLength={500}
                    />
                  </li>
                );
              })}
            </ul>

            {/* Decir cuántos quedaron en blanco es lo que evita mandar media
                cotización sin darse cuenta. No bloquea: mandar una parte es
                exactamente lo que esto vino a permitir. */}
            {sinCargar > 0 ? (
              <p className="text-[14px] text-[#e3c77f] leading-[1.5]">
                {sinCargar === 1
                  ? "Queda 1 ítem sin precio y sin marcar. Si no lo hacés, marcalo: es distinto de dejarlo en blanco."
                  : `Quedan ${sinCargar} ítems sin precio y sin marcar. Los que no hagas, marcalos: es distinto de dejarlos en blanco.`}
              </p>
            ) : null}
          </section>
        </>
      ) : (
        /* ── El pedido es una sola cosa: el campo de siempre ──────────────── */
        <section className="flex flex-col gap-3">
          <label className="flex flex-col gap-2">
            <span className="text-[18px] text-[#e5e2e1]">
              Tu precio <span className="text-[#e3c77f]">*</span>
            </span>
            <div className="flex gap-3">
              <input
                inputMode="decimal"
                className={`${inputCaja} min-h-[64px] text-[28px] font-semibold`}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0"
              />
              <select
                className={`${inputCaja} min-h-[64px] w-[110px]`}
                value={moneda}
                onChange={(e) => setMoneda(e.target.value)}
                aria-label="Moneda"
              >
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <span className="text-[13px] text-[#8A8A8A]">
              Total por todo lo que te piden, con impuestos incluidos si corresponde.
            </span>
          </label>
        </section>
      )}

      <section className="flex flex-col gap-5">
        <label className="flex flex-col gap-2">
          <span className={labelCls}>
            Qué incluye ese precio <span className="text-[#e3c77f]">*</span>
          </span>
          <textarea
            className={`${inputCaja} min-h-[100px]`}
            value={incluye}
            onChange={(e) => setIncluye(e.target.value)}
            placeholder="Flete, peajes, seguro y descarga."
            maxLength={2000}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className={labelCls}>Qué NO incluye</span>
          <textarea
            className={`${inputCaja} min-h-[80px]`}
            value={noIncluye}
            onChange={(e) => setNoIncluye(e.target.value)}
            placeholder="Carga en origen, estadías si hay demora."
            maxLength={2000}
          />
          <span className="text-[13px] text-[#8A8A8A]">
            Es lo que evita el malentendido caro después. Decirlo ahora juega a tu favor.
          </span>
        </label>

        <label className="flex flex-col gap-2">
          <span className={labelCls}>Cuántos días vale este precio</span>
          <input
            inputMode="numeric"
            className={`${inputCaja} max-w-[200px]`}
            value={validez}
            onChange={(e) => setValidez(e.target.value.replace(/\D/g, ""))}
            placeholder="15"
            maxLength={4}
          />
        </label>
      </section>

      {campos.length > 0 ? (
        <section className="flex flex-col gap-5 border-t border-[#1A1A1A] pt-7">
          <div className="flex flex-col gap-1">
            <h2 className="text-[18px] text-[#e5e2e1]">Lo que te preguntan</h2>
            <p className="text-[14px] text-[#8A8A8A] leading-[1.6]">
              Contestá lo que puedas. No es obligatorio, pero es lo que hace que{" "}
              {productora} pueda comparar tu presupuesto con los demás.
            </p>
          </div>
          {campos.map((c) => (
            <label key={c.clave} className="flex flex-col gap-2">
              <span className="text-[15px] text-[#cfc4c5]">{c.etiqueta}</span>
              <input
                className={inputCaja}
                value={respuestas[c.clave] ?? ""}
                onChange={(e) =>
                  setRespuestas((prev) => ({ ...prev, [c.clave]: e.target.value }))
                }
                maxLength={500}
              />
            </label>
          ))}
        </section>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-[#1A1A1A] pt-7">
        <button
          type="button"
          onClick={enviar}
          disabled={pending}
          className="min-h-[52px] px-8 bg-[#0047FF] text-white text-[16px] font-semibold disabled:opacity-50"
        >
          {pending ? "Enviando..." : inicial ? "Guardar los cambios" : "Enviar mi presupuesto"}
        </button>
        <span className="text-[13px] text-[#8A8A8A]">
          Podés corregirlo hasta que cierre el pedido.
        </span>
      </div>
    </div>
  );
}
