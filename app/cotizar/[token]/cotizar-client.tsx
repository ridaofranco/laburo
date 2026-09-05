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

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { guardarCotizacion } from "./actions";

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
}

export function CotizarForm({
  token,
  campos,
  inicial,
  productora,
}: {
  token: string;
  campos: { clave: string; etiqueta: string }[];
  inicial: CotizacionInicial | null;
  productora: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [monto, setMonto] = useState(inicial ? String(inicial.monto) : "");
  const [moneda, setMoneda] = useState(inicial?.moneda ?? "ARS");
  const [incluye, setIncluye] = useState(inicial?.incluye ?? "");
  const [noIncluye, setNoIncluye] = useState(inicial?.no_incluye ?? "");
  const [validez, setValidez] = useState(inicial?.validez_dias ? String(inicial.validez_dias) : "");
  const [respuestas, setRespuestas] = useState<Record<string, string>>(
    inicial?.respuestas ?? {},
  );

  function enviar() {
    const n = Number((monto || "").replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", "."));
    if (!n || Number.isNaN(n) || n <= 0) {
      toast.error("Poné el precio: sin un número, esto no se puede comparar.");
      return;
    }
    if (!incluye.trim()) {
      toast.error("Contá qué incluye ese precio.");
      return;
    }

    startTransition(async () => {
      const r = await guardarCotizacion({
        token,
        monto: n,
        incluye,
        noIncluye,
        moneda,
        validezDias: validez ? Number(validez) : null,
        respuestas,
      });
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

      {/* El precio, primero y grande. */}
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
