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

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { crearPedido } from "../actions";
import { plantillaDe, type CampoDesglose } from "@/lib/cotizaciones";
import { desdeInputLocal } from "@/lib/dates";
import { sniffCvMime } from "@/lib/cv";

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

  // ── El brief ──────────────────────────────────────────────────────────────
  const [brief, setBrief] = useState("");
  const [leyendo, setLeyendo] = useState(false);
  const [faltantes, setFaltantes] = useState<string[]>([]);
  const [archivo, setArchivo] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /**
   * Lee el brief y rellena el formulario.
   *
   * ⚠️ NO crea nada: deja un borrador arriba del formulario de siempre, que la
   * persona revisa y edita. Lo que la IA no encontró queda vacío, nunca
   * inventado, y lo que le falta al brief se avisa aparte en vez de rellenarse
   * con un supuesto.
   */
  async function leerBrief() {
    const file = fileRef.current?.files?.[0] ?? null;
    if (!brief.trim() && !file) {
      toast.error("Pegá el pedido del cliente o subí el archivo.");
      return;
    }

    setLeyendo(true);
    try {
      let mime: string | undefined;
      let data: string | undefined;

      if (file) {
        const buf = new Uint8Array(await file.arrayBuffer());
        // El MIME se sniffea por magic bytes, igual que el CV: lo que declara el
        // navegador miente seguido (sobre todo en Android).
        const sniffed = sniffCvMime(buf.slice(0, 16));
        if (!sniffed) {
          toast.error("Ese archivo no lo puedo leer. Va PDF o una foto.");
          setLeyendo(false);
          return;
        }
        mime = sniffed;
        let bin = "";
        for (let i = 0; i < buf.length; i += 8192) {
          bin += String.fromCharCode(...buf.subarray(i, i + 8192));
        }
        data = btoa(bin);
      }

      const res = await fetch("/api/pedido-desde-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: brief.trim(), mime, data, categoria }),
      });

      if (!res.ok) {
        const MOTIVOS: Record<number, string> = {
          401: "Se cerró tu sesión. Entrá de nuevo.",
          413: "El archivo es muy grande. Probá con uno más chico o pegá el texto.",
          415: "Ese archivo no lo puedo leer. Va PDF o una foto.",
          429: "Esperá un minuto: se leyeron muchos briefs seguidos.",
          504: "Tardó demasiado. Probá con el texto pegado en vez del archivo.",
        };
        toast.error(MOTIVOS[res.status] ?? "No se pudo leer. Cargalo a mano, que es igual de válido.");
        setLeyendo(false);
        return;
      }

      const { data: d } = (await res.json()) as {
        data: {
          titulo: string | null;
          descripcion: string | null;
          categoria: string | null;
          provincia: string | null;
          ciudad: string | null;
          necesario_para: string | null;
          campos: CampoDesglose[];
          faltantes: string[];
        };
      };

      // Solo se pisa lo que está vacío... salvo que venga del brief y la persona
      // no haya escrito nada todavía. Escribir arriba de lo que alguien tipeó a
      // mano es la forma más rápida de que no vuelva a usar el botón.
      if (d.titulo && !titulo.trim()) setTitulo(d.titulo);
      if (d.descripcion && !descripcion.trim()) setDescripcion(d.descripcion);
      if (d.categoria && !categoria) setCategoria(d.categoria);
      if (d.provincia && !provincia) setProvincia(d.provincia);
      if (d.ciudad && !ciudad.trim()) setCiudad(d.ciudad);
      if (d.necesario_para && !necesarioPara) setNecesarioPara(d.necesario_para);
      if (d.campos?.length && !tocoElDesglose) {
        setCampos(d.campos);
        setTocoElDesglose(true); // ya no es la plantilla del rubro: es de este caso
      }
      setFaltantes(d.faltantes ?? []);
      setArchivo(file?.name ?? null);

      toast.success(
        d.faltantes?.length
          ? `Listo. Ojo: hay ${d.faltantes.length} ${d.faltantes.length === 1 ? "dato" : "datos"} que conviene aclarar.`
          : "Listo, revisalo antes de crear.",
      );
    } catch (e) {
      console.error("[nuevo pedido] leer brief falló:", e);
      toast.error("No se pudo leer. Cargalo a mano, que es igual de válido.");
    } finally {
      setLeyendo(false);
    }
  }

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
      {/* ── Contá qué necesitás ─────────────────────────────────────────────
          Franco: "la licitación se arma de alguna forma, y tengo que contar".
          Contar es el trabajo, y esto lo saca del medio: pegás el mail del
          cliente o subís el brief, y el formulario de abajo queda armado.
          ⚠️ No crea nada: es un borrador para revisar. */}
      <section className="border border-[#222] bg-[#0A0A0A] p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-[20px] text-[#e5e2e1]">Contá qué necesitás</h2>
          <p className="text-[15px] text-[#cfc4c5] leading-[1.6]">
            Pegá el mail del cliente, el mensaje de WhatsApp o lo que tengas, y armo
            el pedido. También podés subir el PDF del brief. Después lo revisás y lo
            corregís: no se manda nada hasta que vos lo digas.
          </p>
        </div>

        <textarea
          className={`${inputCaja} min-h-[120px]`}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Hola Franco, necesitamos llevar un pallet desde Villa Soldati a siete puntos del país entre el 20 y el 25. Son cajas de 30 kilos..."
          maxLength={40000}
        />

        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-3 cursor-pointer text-[14px] text-[#cfc4c5] hover:text-[#e5e2e1] transition-colors">
            <span className="min-h-[44px] px-5 border border-[#2a2a2a] inline-flex items-center">
              Subir el brief
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*"
              className="sr-only"
              onChange={(e) => setArchivo(e.target.files?.[0]?.name ?? null)}
            />
            {archivo ? <span className="text-[13px] text-[#8A8A8A]">{archivo}</span> : null}
          </label>

          <button
            type="button"
            onClick={leerBrief}
            disabled={leyendo}
            className="min-h-[48px] px-6 border border-[#0047FF] text-[15px] text-[#e5e2e1] hover:bg-[#0047FF] transition-colors disabled:opacity-50"
          >
            {leyendo ? "Leyendo..." : "Armar el pedido"}
          </button>
        </div>

        {/* Lo que el brief NO dice. No rellena ningún campo a propósito: es la
            lista de repreguntas que te vas a comer si lo mandás así. De las 45
            respuestas al pedido del pallet, 43 eran exactamente esto. */}
        {faltantes.length > 0 ? (
          <div className="flex flex-col gap-2 border-l-2 border-[#e3c77f] pl-4 mt-1">
            <p className="label-tech text-[11px] uppercase tracking-widest text-[#e3c77f]">
              Esto no lo aclara, y te lo van a preguntar
            </p>
            <ul className="flex flex-col gap-1">
              {faltantes.map((f, i) => (
                <li key={i} className="text-[14px] text-[#cfc4c5] leading-[1.5]">
                  · {f}
                </li>
              ))}
            </ul>
            <p className="text-[13px] text-[#8A8A8A] mt-1">
              Agregalo al detalle o sumalo como pregunta. Cada uno de estos es un ida
              y vuelta de mails que te ahorrás.
            </p>
          </div>
        ) : null}
      </section>

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
