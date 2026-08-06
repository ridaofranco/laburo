"use client";

/**
 * "Cuánta gente entra": el bloque propio del salón dentro del panel.
 *
 * Ocupa el lugar que en un proveedor ocupan los servicios, y no es una decisión
 * estética: es el equivalente exacto. El rubro es lo que hace encontrable a un
 * proveedor; la capacidad es lo que hace encontrable a un salón. Un salón sin
 * capacidad cargada existe en la base y no aparece en una sola búsqueda.
 *
 * ── POR QUÉ SE PUEDE EDITAR ─────────────────────────────────────────────────
 * Porque el alta pide la capacidad de una y la gente se equivoca escribiendo un
 * número. Sin esta pantalla, un 30 tipeado en lugar de 300 dejaba al salón mal
 * listado para siempre y la única salida era tocarle la base a mano.
 *
 * ── LOS TRES ESTADOS ────────────────────────────────────────────────────────
 * Catering y estacionamiento son sí / no / no lo dijo. El tercero NO se muestra
 * en la ficha pública. Si fueran checkboxes, no contestar se guardaría como
 * "no", o sea que le inventaríamos al salón la respuesta que le hace perder la
 * consulta.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import type { Acceso } from "@/lib/proveedor-acceso";
import type { DatosSalon } from "@/app/acceso-proveedor/[token]/estados";
import { guardarSalon } from "@/app/acceso-proveedor/[token]/actions";
import { AMENITIES_SUGERIDOS, TIPOS_EVENTO_SUGERIDOS, textoCapacidad } from "@/lib/salones";

const inputCls =
  "w-full min-h-[48px] rounded-xl bg-surface-2 border border-border text-fg text-body px-sm outline-none focus:border-fg transition-colors [color-scheme:dark]";
const labelCls = "text-label text-fg-muted";

/** Texto a entero. Vacío y basura dan null, nunca NaN viajando a la base. */
function aEntero(v: string): number | null {
  const n = Number.parseInt(v.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function Chip({
  texto,
  activo,
  onClick,
}: {
  texto: string;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`px-sm py-2 rounded-lg border text-label transition-colors ${
        activo
          ? "border-fg bg-surface-2 text-fg"
          : "border-border text-fg-subtle hover:text-fg hover:border-fg"
      }`}
    >
      {texto}
    </button>
  );
}

function TresEstados({
  titulo,
  valor,
  onChange,
  textoSi,
  textoNo,
}: {
  titulo: string;
  valor: boolean | null;
  onChange: (v: boolean | null) => void;
  textoSi: string;
  textoNo: string;
}) {
  return (
    <div className="flex flex-col gap-xs">
      <span className={labelCls}>{titulo}</span>
      <div className="flex flex-wrap gap-xs">
        <Chip
          texto={textoSi}
          activo={valor === true}
          onClick={() => onChange(valor === true ? null : true)}
        />
        <Chip
          texto={textoNo}
          activo={valor === false}
          onClick={() => onChange(valor === false ? null : false)}
        />
      </div>
      <p className="text-label text-fg-subtle">
        Si no elegís ninguno, en tu ficha no se muestra nada.
      </p>
    </div>
  );
}

export function SalonCapacidad({
  acceso,
  salon,
}: {
  acceso: Acceso;
  salon: DatosSalon | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [guardado, setGuardado] = useState(false);

  const [capMax, setCapMax] = useState(salon?.capacidad_max?.toString() ?? "");
  const [capMin, setCapMin] = useState(salon?.capacidad_min?.toString() ?? "");
  const [m2, setM2] = useState(salon?.superficie_m2?.toString() ?? "");
  const [direccion, setDireccion] = useState(salon?.direccion ?? "");
  const [amenities, setAmenities] = useState<string[]>(salon?.amenities ?? []);
  const [tipos, setTipos] = useState<string[]>(salon?.tipos_evento ?? []);
  const [catering, setCatering] = useState<boolean | null>(salon?.catering_propio ?? null);
  const [estacionamiento, setEstacionamiento] = useState<boolean | null>(
    salon?.estacionamiento ?? null,
  );

  // Las sugerencias más lo que el salón ya tenía cargado. Sin esto, un valor
  // escrito a mano o cargado desde otra pantalla desaparecía de la lista al
  // abrir el panel, y guardar lo borraba sin que nadie lo tocara.
  const listaAmenities = Array.from(new Set([...AMENITIES_SUGERIDOS, ...amenities]));
  const listaTipos = Array.from(new Set([...TIPOS_EVENTO_SUGERIDOS, ...tipos]));

  const resumen = textoCapacidad(aEntero(capMin), aEntero(capMax));

  function toggle(lista: string[], set: (v: string[]) => void, valor: string) {
    set(lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor]);
  }

  function onGuardar() {
    if (pending) return;
    setGuardado(false);

    // Se valida acá también para no gastar un viaje y, sobre todo, para decirle
    // qué pasa en su idioma en vez de esperar el código de la RPC.
    const max = aEntero(capMax);
    if (!max) {
      toast.error("Poné cuánta gente entra como máximo. Es con lo que te buscan.");
      return;
    }
    const min = aEntero(capMin);
    if (min != null && min > max) {
      toast.error("El mínimo no puede ser más grande que el máximo.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await guardarSalon(acceso, {
          capacidad_max: max,
          capacidad_min: min,
          superficie_m2: aEntero(m2),
          direccion,
          amenities,
          tipos_evento: tipos,
          catering_propio: catering,
          estacionamiento,
        });
        if (res.ok) {
          setGuardado(true);
          toast.success("Guardado.");
          router.refresh();
          return;
        }
        toast.error(res.mensaje);
        if (res.terminal) router.refresh();
      } catch {
        toast.error("Algo falló. Probá de nuevo en un momento.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-md">
      <p className="text-body text-fg-muted">
        Es lo primero que te preguntan y con lo que te encuentran. Si alguien
        busca un salón para 180 personas, le mostramos los que llegan a ese
        número y a los que no les queda demasiado grande.
      </p>

      <div className="grid grid-cols-2 gap-sm">
        <label className="flex flex-col gap-3xs" htmlFor="sc_max">
          <span className={labelCls}>Máximo de personas *</span>
          <input
            id="sc_max"
            type="number"
            inputMode="numeric"
            min={1}
            max={100000}
            className={inputCls}
            value={capMax}
            onChange={(e) => setCapMax(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-3xs" htmlFor="sc_min">
          <span className={labelCls}>Mínimo</span>
          <input
            id="sc_min"
            type="number"
            inputMode="numeric"
            min={1}
            max={100000}
            className={inputCls}
            value={capMin}
            onChange={(e) => setCapMin(e.target.value)}
          />
        </label>
      </div>

      {/* Lo que va a leer la gente, tal cual, mientras lo escribe. Es la forma
          más barata de que un 30 escrito en lugar de 300 se vea antes de
          guardarlo y no tres semanas después. */}
      {resumen ? (
        <p className="text-label text-fg-subtle border-l-2 border-border pl-sm">
          En tu ficha se va a leer: <span className="text-fg">{resumen}</span>
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-sm">
        <label className="flex flex-col gap-3xs" htmlFor="sc_m2">
          <span className={labelCls}>Superficie en m²</span>
          <input
            id="sc_m2"
            type="number"
            inputMode="numeric"
            min={1}
            max={1000000}
            className={inputCls}
            value={m2}
            onChange={(e) => setM2(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-3xs" htmlFor="sc_dir">
          <span className={labelCls}>Dirección</span>
          <input
            id="sc_dir"
            className={inputCls}
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            maxLength={300}
          />
        </label>
      </div>

      <div className="flex flex-col gap-xs">
        <span className={labelCls}>Para qué se alquila</span>
        <div className="flex flex-wrap gap-xs">
          {listaTipos.map((t) => (
            <Chip
              key={t}
              texto={t}
              activo={tipos.includes(t)}
              onClick={() => toggle(tipos, setTipos, t)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-xs">
        <span className={labelCls}>Qué tiene</span>
        <div className="flex flex-wrap gap-xs">
          {listaAmenities.map((a) => (
            <Chip
              key={a}
              texto={a}
              activo={amenities.includes(a)}
              onClick={() => toggle(amenities, setAmenities, a)}
            />
          ))}
        </div>
      </div>

      <TresEstados
        titulo="¿Se puede traer catering de afuera?"
        valor={catering}
        onChange={setCatering}
        textoSi="Sí, se puede"
        textoNo="No, lo pone la casa"
      />

      <TresEstados
        titulo="¿Tiene estacionamiento?"
        valor={estacionamiento}
        onChange={setEstacionamiento}
        textoSi="Sí, tiene"
        textoNo="No tiene"
      />

      <button
        type="button"
        disabled={pending}
        onClick={onGuardar}
        className="flex items-center justify-center gap-xs min-h-[48px] rounded-none bg-fg text-surface-0 border border-fg label-tech text-[13px] px-md transition-colors hover:bg-transparent hover:text-fg disabled:opacity-60 disabled:pointer-events-none"
      >
        {pending ? "Guardando…" : "Guardar"}
      </button>

      {guardado && !pending ? (
        <p className="flex items-center gap-xs text-label text-positive">
          <Check size={16} aria-hidden="true" />
          Listo, quedó guardado.
        </p>
      ) : null}
    </div>
  );
}
