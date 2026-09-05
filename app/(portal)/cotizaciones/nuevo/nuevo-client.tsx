"use client";

/**
 * El formulario del pedido de precio.
 *
 * ── LAS TRES COSAS QUE ESTA PANTALLA HACE A PROPÓSITO ───────────────────────
 *
 * 1. **El desglose se precarga solo al elegir el rubro.** Arrancar de cero es
 *    la forma más rápida de olvidarse el dato que después cuesta quince mails.
 *    Son sugerencias: se editan y se borran, una por una.
 *
 * 2. **La fecha de cierre viene con un valor puesto (una semana).** Un campo
 *    obligatorio en blanco es donde se abandona un formulario, y "una semana"
 *    es la respuesta correcta la mayoría de las veces.
 *
 * 3. **No hay ningún campo de "requisito excluyente".** Es la regla 2 y es
 *    deliberado: pedir portón hidráulico como condición espantó a 37 empresas.
 *    Lo que necesitás se pregunta en el desglose, y al comparar ves quién lo
 *    cumple.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { crearPedido } from "../actions";
import { plantillaDe, type CampoDesglose } from "@/lib/cotizaciones";
import { desdeInputLocal } from "@/lib/dates";

const inputCaja =
  "w-full min-h-[48px] bg-[#121212] border border-[#2a2a2a] focus:border-[#e5e2e1] outline-none text-[16px] text-[#e5e2e1] px-4 py-3 rounded-none transition-colors [color-scheme:dark]";
const labelCls = "label-tech text-[11px] uppercase tracking-widest text-[#cfc4c5]";

/** Dentro de una semana, en el formato que quiere <input datetime-local>. */
function enUnaSemana(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(18, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function NuevoPedidoForm({
  categorias,
  provincias,
}: {
  categorias: string[];
  provincias: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState("");
  const [provincia, setProvincia] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [necesarioPara, setNecesarioPara] = useState("");
  const [cierraAt, setCierraAt] = useState(enUnaSemana);
  const [campos, setCampos] = useState<CampoDesglose[]>(plantillaDe(""));
  const [tocoElDesglose, setTocoElDesglose] = useState(false);

  /** Al elegir rubro se trae su plantilla, salvo que la persona ya haya editado
   *  el desglose: pisarle lo que escribió sería el peor momento para ser útil. */
  function elegirCategoria(c: string) {
    setCategoria(c);
    if (!tocoElDesglose) setCampos(plantillaDe(c));
  }

  function editarCampo(i: number, etiqueta: string) {
    setTocoElDesglose(true);
    setCampos((prev) => prev.map((c, j) => (j === i ? { ...c, etiqueta } : c)));
  }

  function borrarCampo(i: number) {
    setTocoElDesglose(true);
    setCampos((prev) => prev.filter((_, j) => j !== i));
  }

  function agregarCampo() {
    setTocoElDesglose(true);
    setCampos((prev) => [...prev, { clave: `extra_${prev.length + 1}`, etiqueta: "" }]);
  }

  function guardar() {
    if (!titulo.trim()) {
      toast.error("Poné un título: es lo primero que lee el que va a cotizar.");
      return;
    }
    const cierra = desdeInputLocal(cierraAt);
    if (!cierra) {
      toast.error("Falta la fecha de cierre.");
      return;
    }
    if (new Date(cierra).getTime() <= Date.now()) {
      toast.error("La fecha de cierre tiene que ser futura.");
      return;
    }

    // Las preguntas vacías no viajan: un desglose con renglones en blanco le
    // llega así al que cotiza.
    const limpios = campos
      .map((c) => ({ clave: c.clave, etiqueta: c.etiqueta.trim() }))
      .filter((c) => c.etiqueta);

    startTransition(async () => {
      const r = await crearPedido({
        titulo,
        descripcion,
        categoria,
        provincia,
        ciudad,
        necesarioPara,
        cierraAt: cierra,
        campos: limpios,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Pedido creado. Ahora elegí a quién mandárselo.");
      router.push(`/cotizaciones/${r.requestId}`);
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-5">
        <label className="flex flex-col gap-2">
          <span className={labelCls}>
            Qué necesitás <span className="text-[#e3c77f]">*</span>
          </span>
          <input
            className={inputCaja}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Transporte de un pallet a 7 destinos"
            maxLength={160}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className={labelCls}>Detalle</span>
          <textarea
            className={`${inputCaja} min-h-[120px]`}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Todo lo que necesita saber para poder darte un número. Cuanto más concreto, menos repreguntas."
            maxLength={2000}
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <label className="flex flex-col gap-2">
            <span className={labelCls}>Rubro</span>
            <select
              className={inputCaja}
              value={categoria}
              onChange={(e) => elegirCategoria(e.target.value)}
            >
              <option value="">Elegir rubro</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className={labelCls}>Provincia</span>
            <select
              className={inputCaja}
              value={provincia}
              onChange={(e) => setProvincia(e.target.value)}
            >
              <option value="">Sin especificar</option>
              {provincias.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className={labelCls}>Ciudad</span>
            <input
              className={inputCaja}
              value={ciudad}
              onChange={(e) => setCiudad(e.target.value)}
              maxLength={120}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className={labelCls}>Para cuándo lo necesitás</span>
            <input
              type="date"
              className={inputCaja}
              value={necesarioPara}
              onChange={(e) => setNecesarioPara(e.target.value)}
            />
          </label>
        </div>

        <label className="flex flex-col gap-2">
          <span className={labelCls}>
            Hasta cuándo recibís presupuestos <span className="text-[#e3c77f]">*</span>
          </span>
          <input
            type="datetime-local"
            className={inputCaja}
            value={cierraAt}
            onChange={(e) => setCierraAt(e.target.value)}
          />
          <span className="text-[13px] text-[#8A8A8A]">
            Después de esa fecha y hora, la pantalla del proveedor se cierra sola. Es lo
            que hace que cotizar no sea algo para mañana.
          </span>
        </label>
      </section>

      <section className="flex flex-col gap-4 border-t border-[#1A1A1A] pt-8">
        <div className="flex flex-col gap-2">
          <h2 className="text-[20px] text-[#e5e2e1]">Qué querés que te detallen</h2>
          <p className="text-[15px] text-[#cfc4c5] leading-[1.6]">
            Además del precio. Sirve para comparar de verdad: un presupuesto que incluye
            seguro y otro que no, no son el mismo precio. Editá o borrá lo que no te
            sirva.
          </p>
        </div>

        <ul className="flex flex-col gap-3">
          {campos.map((c, i) => (
            <li key={c.clave} className="flex items-center gap-3">
              <input
                className={inputCaja}
                value={c.etiqueta}
                onChange={(e) => editarCampo(i, e.target.value)}
                placeholder="Otra pregunta"
                maxLength={200}
              />
              <button
                type="button"
                onClick={() => borrarCampo(i)}
                className="min-h-[44px] min-w-[44px] border border-[#2a2a2a] text-[#cfc4c5] hover:border-[#e5e2e1] hover:text-[#e5e2e1] transition-colors"
                aria-label="Borrar esta pregunta"
              >
                ×
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={agregarCampo}
          className="self-start min-h-[44px] px-5 border border-[#2a2a2a] text-[15px] text-[#cfc4c5] hover:border-[#e5e2e1] hover:text-[#e5e2e1] transition-colors"
        >
          Sumar pregunta
        </button>
      </section>

      <div className="flex flex-wrap gap-4 border-t border-[#1A1A1A] pt-8">
        <button
          type="button"
          onClick={guardar}
          disabled={pending}
          className="min-h-[48px] px-8 bg-[#0047FF] text-white text-[15px] font-semibold disabled:opacity-50"
        >
          {pending ? "Creando..." : "Crear y elegir a quién"}
        </button>
        <span className="text-[13px] text-[#8A8A8A] self-center">
          Todavía no se le manda nada a nadie.
        </span>
      </div>
    </div>
  );
}
