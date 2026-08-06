"use client";

/**
 * Piezas COMPARTIDAS entre el registro (/sumate) y el editor de perfil del staff.
 * Un solo producto: los mismos campos, opciones, estilos y el mismo autollenado
 * con IA (parse-cv) en las dos aristas. Evita drift entre somosder.ar y la app.
 */

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { CV_MAX_BYTES } from "@/lib/cv";
import type { CvSubido } from "@/lib/cv-subida-cliente";

export const WORK_REGIONS = [
  "En mi país de residencia",
  "Argentina",
  "Resto de LATAM",
  "España / Europa",
  "EEUU / Canadá",
  "Medio Oriente",
  "Cualquier país — dispuesto/a a viajar",
];
export const LEGAL_OPTS = [
  "Ciudadano/a o residente con permiso",
  "Tengo permiso de trabajo",
  "Necesitaría sponsor / visa",
  "No estoy seguro/a",
];
export const AVISO_OPTS = [
  "Disponibilidad inmediata",
  "Con 24–48 hs de aviso",
  "Con 1 semana de aviso",
  "A coordinar",
];
export const YEARS_OPTS = ["0–1", "1–3", "3–5", "5–10", "10+"];

/**
 * ── LOS DOS TECHOS DEL CV YA NO EXISTEN (6/8, segunda vuelta) ───────────────
 *
 * Hasta hoy eran dos, y ninguno era una decisión de producto: eran dos límites
 * de infraestructura que se filtraban hasta la cara de la persona. 4 MB porque
 * el archivo viajaba adentro de un Server Action, y 3 MB para poder LEERLO
 * porque viajaba en base64 (que infla 33%) y Vercel corta el body de una
 * función en 4,5 MB. Entre 3 y 4 MB había una franja absurda: el CV se subía
 * perfecto pero no se podía leer. Franco, textual: *"no lee los pdfs y tampoco
 * te deja enviar, se rompió todo, no entiendo que poronga pasa"*.
 *
 * Ahora el archivo va derecho del navegador a Supabase y no toca Vercel, así
 * que los dos topes desaparecen y queda UNO SOLO, que sí es una decisión:
 * `CV_MAX_BYTES` (10 MB), el mismo que el servidor ya validaba.
 *
 * Los dos nombres viejos quedan apuntando al número nuevo para no romper lo que
 * los importa, y porque la distinción que representaban ya no significa nada.
 */
export const CV_MAX_ADJUNTAR = CV_MAX_BYTES;
export const CV_MAX_LEER = CV_MAX_BYTES;

/** El tamaño en MB, para decírselo a la persona en criollo. */
export const enMb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1).replace(".", ",");

export const labelCls =
  "block mb-2 label-tech text-[11px] uppercase tracking-[0.1em] text-[#cfc4c5]";
export const inputCls =
  "w-full bg-transparent border-0 border-b border-[#4c4546] focus:border-[#e5e2e1] outline-none text-[16px] text-[#e5e2e1] py-3 px-0 rounded-none transition-colors placeholder:text-[#8a8a8a] [color-scheme:dark]";
export const selectCls = `${inputCls} appearance-none`;
export const sectionTitle =
  "font-[family-name:var(--font-syne)] text-[22px] font-semibold text-[#c6c6c6] uppercase tracking-tight";

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-6 border-t border-[#1A1A1A] pt-8">
      <h2 className={sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

export function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 border border-[#4c4546] px-4 py-3 cursor-pointer hover:border-[#c6c6c6] transition-colors has-[:focus-visible]:border-[#c6c6c6]">
      {/* input primero + peer para que el foco del teclado marque el recuadro visible */}
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        className={`w-5 h-5 border grid place-items-center text-[11px] shrink-0 peer-focus-visible:ring-2 peer-focus-visible:ring-[#c6c6c6] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-black ${
          checked ? "bg-[#c6c6c6] border-[#c6c6c6] text-black" : "border-[#4c4546]"
        }`}
      >
        {checked ? "✓" : ""}
      </span>
      <span className="text-[14px] text-[#e5e2e1]">{label}</span>
    </label>
  );
}

/** Datos que devuelve el parser de CV (IA). */
export interface CvParsed {
  nombre?: string | null;
  apellido?: string | null;
  email?: string | null;
  telefono?: string | null;
  ciudad?: string | null;
  pais?: string | null;
  linkedin_url?: string | null;
  portfolio_url?: string | null;
  anios_experiencia?: string | null;
  experiencia_detalle?: string | null;
  oficios?: string[] | null;
}

/**
 * Hook de autollenado con IA: manda el archivo a /api/parse-cv (Gemini) y
 * devuelve los datos. Estado: idle | loading | ok | error | nokey.
 */
/**
 * Por qué no se pudo leer un CV. Antes TODO caía en "error" y la pantalla decía
 * siempre lo mismo ("No pudimos leer el CV"), así que tres problemas
 * completamente distintos se veían idénticos y ninguno se podía arreglar:
 *
 *  · formato → es un Word. NUNCA se va a poder leer, y además el guardado
 *    también lo rechaza. La salida es subirlo en PDF.
 *  · grande  → se pasa del límite de la función. La salida es uno más liviano.
 *  · vacio   → el lector contestó bien pero no encontró datos (un PDF escaneado,
 *    sin capa de texto). ESTE es el peor de los tres, porque antes ni siquiera
 *    contaba como error: la pantalla no completaba nada y no decía nada, y del
 *    lado de la persona eso es "no anda".
 *
 * 6/8, SEGUNDA VUELTA. Los tres de arriba no alcanzaban: quedaban DOS fallas más
 * cayendo juntas en el genérico "falla", y una de ellas es la que Franco vio.
 * Medido contra producción el 6/8: el séptimo intento en un minuto devuelve
 * `{ok:false, ...}` con status 429, que entraba por `if (!out.ok)` y mostraba
 * "No pudimos leer el CV". O sea que el freno de abuso era INDISTINGUIBLE de un
 * CV ilegible, y encima el freno por hora deja a la persona afuera 60 minutos.
 *
 *  · muchas  → 429, el freno de abuso. No es el archivo: es la insistencia.
 *  · lector  → 502/504, el lector (Gemini) falló o tardó demasiado. Tampoco es
 *    el archivo, y volver a intentar en un rato suele alcanzar.
 */
export type MotivoCv = "formato" | "grande" | "vacio" | "falla" | "nokey" | "muchas" | "lector";

export function useCvAutofill() {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error" | "nokey">("idle");
  /**
   * El motivo va en un REF y no solo en estado, y no es un detalle: el que
   * llama hace `const d = await run(...)` y lee el motivo en la línea siguiente.
   * `setState` de React es asíncrono, así que en ese punto el estado TODAVÍA
   * tiene el valor viejo y el mensaje saldría siempre el genérico, que es
   * exactamente el problema que vinimos a arreglar. El ref se actualiza en el
   * acto. El estado se mantiene aparte para lo que sí se renderiza.
   */
  const motivoRef = useRef<MotivoCv | null>(null);
  const [motivo, setMotivoState] = useState<MotivoCv | null>(null);
  const setMotivo = (m: MotivoCv | null) => {
    motivoRef.current = m;
    setMotivoState(m);
  };
  /**
   * El código técnico de la falla (p.ej. "429", "502 gemini"), para mostrarlo
   * chiquito al lado del mensaje. No es para la persona que se anota: es para
   * que cuando alguien avise "no anda" se pueda saber CUÁL de las seis fallas
   * fue, en vez de adivinar. El 6/8 se perdieron horas por no tenerlo.
   */
  const codigoRef = useRef<string | null>(null);
  const [codigo, setCodigoState] = useState<string | null>(null);
  const setCodigo = (c: string | null) => {
    codigoRef.current = c;
    setCodigoState(c);
  };

  /**
   * Lee un CV QUE YA ESTÁ SUBIDO. Recibe el nombre del objeto, no el archivo.
   *
   * Antes esta función leía el archivo entero a base64 y lo mandaba adentro del
   * request. Ese era el techo de 3 MB: base64 infla 33% y Vercel corta el body
   * de una función en 4,5 MB, así que el pedido moría antes de llegar al código.
   * Ahora el archivo ya viajó derecho a Supabase (ver lib/cv-subida-cliente.ts)
   * y por acá pasan unos 200 bytes. El techo dejó de existir.
   */
  async function run(cv: CvSubido, oficios: string[]): Promise<CvParsed | null> {
    setMotivo(null);
    setCodigo(null);
    setStatus("loading");
    try {
      const r = await fetch("/api/parse-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: cv.path, firma: cv.firma, oficios }),
      });
      // 413 lo devuelve la INFRAESTRUCTURA (Vercel corta el body de la función),
      // y el cuerpo es texto plano, no JSON: sin esta rama, el r.json() de abajo
      // tira y el motivo real se perdía adentro del catch genérico.
      if (r.status === 413) {
        setCodigo("413");
        setMotivo("grande");
        setStatus("error");
        return null;
      }
      /**
       * EL FRENO DE ABUSO, QUE ANTES SE VEÍA COMO "CV ILEGIBLE".
       * 429 = probaste demasiadas veces seguidas. El cuerpo es `{ok:false,...}`,
       * así que caía en la rama de abajo y decía "No pudimos leer el CV": el
       * archivo no tenía nada que ver y la persona seguía cambiando de archivo.
       */
      if (r.status === 429) {
        setCodigo("429");
        setMotivo("muchas");
        setStatus("error");
        return null;
      }
      // El cuerpo se lee UNA sola vez. Antes el 500 hacía su propio r.json() y,
      // si no era no_key, seguía de largo hasta un segundo r.json() que tiraba
      // "body stream already read" y terminaba en el catch genérico.
      const out = await r.json().catch(() => null as Record<string, unknown> | null);
      const err = typeof out?.error === "string" ? out.error : null;
      if (r.status === 500 && err === "no_key") {
        setCodigo("500 no_key");
        setMotivo("nokey");
        setStatus("nokey");
        return null;
      }
      if (!out?.ok) {
        setCodigo(`${r.status}${err ? ` ${err}` : ""}`);
        setMotivo(
          err === "bad_mime" ? "formato" : r.status === 502 || r.status === 504 ? "lector" : "falla",
        );
        setStatus("error");
        return null;
      }

      // LEYÓ, PERO NO SACÓ NADA. Pasa con los PDF escaneados: son una foto
      // adentro de un PDF y no tienen texto. Antes esto devolvía "ok" con todo
      // en null: la pantalla no completaba un solo campo y tampoco avisaba, así
      // que del lado de la persona era exactamente igual que si estuviera roto.
      const d = (out.data ?? {}) as CvParsed;
      const saleAlgo = Boolean(
        d.nombre || d.apellido || d.email || d.telefono || d.ciudad ||
          d.experiencia_detalle || (d.oficios && d.oficios.length),
      );
      if (!saleAlgo) {
        setMotivo("vacio");
        setStatus("error");
        return null;
      }

      setStatus("ok");
      return d;
    } catch {
      // Acá ya no llega ni el 413 ni el 429 ni el doble r.json(): lo que queda
      // es una falla de red real o el FileReader.
      setCodigo("red");
      setMotivo("falla");
      setStatus("error");
      return null;
    }
  }

  return { status, motivo, motivoRef, codigo, codigoRef, run };
}

/**
 * El mensaje que se le muestra a la persona, según por qué falló.
 *
 * El `codigo` va al final entre paréntesis y es a propósito: cuando alguien
 * avisa "no me anda", ese dato es la diferencia entre arreglarlo en minutos y
 * pasarse un día probando hipótesis. Es corto y no asusta; el mensaje útil ya
 * está dicho antes.
 */
export function mensajeCv(motivo: MotivoCv | null, codigo?: string | null): string {
  const base = textoCv(motivo);
  return codigo ? `${base} (código ${codigo})` : base;
}

function textoCv(motivo: MotivoCv | null): string {
  switch (motivo) {
    case "formato":
      return "Los CV en Word no los podemos leer. Subilo en PDF (desde Word: Archivo, Guardar como, PDF) o completá los datos a mano.";
    case "grande":
      return "Tu CV es muy grande para leerlo solo. Se sube igual: completá tu nombre y tu mail y listo.";
    case "vacio":
      return "Tu CV se subió bien, pero no pudimos sacarle los datos (suele pasar cuando es una foto escaneada). Completalos a mano y ya quedás anotado.";
    case "nokey":
      return "El autocompletado no está disponible ahora. Completá los datos a mano y ya quedás anotado.";
    case "muchas":
      // NO es el archivo. Decirlo así, porque el reflejo es cambiar de archivo.
      return "Probaste varias veces seguidas y el sistema te frenó un rato. No es tu CV: esperá un minuto y volvé a intentar, o completá los datos a mano y ya quedás anotado.";
    case "lector":
      return "El lector de CV no contestó a tiempo. No es tu CV: probá de nuevo en un rato, o completá los datos a mano y ya quedás anotado.";
    default:
      return "No pudimos leer el CV. Se sube igual: completá tu nombre y tu mail a mano.";
  }
}

/** Selector de oficios agrupado (mismo taxonomía/estilo en registro y perfil). */
export function OficiosPicker({
  oficios,
  selected,
  onToggle,
}: {
  oficios: { cat: { es: string; en: string }; items: { es: string; en: string }[] }[];
  selected: Set<string>;
  onToggle: (val: string) => void;
}) {
  return (
    <div className="border border-[#1A1A1A]">
      {oficios.map((g) => {
        const count = g.items.filter((it) => selected.has(it.es)).length;
        return (
          <details key={g.cat.es} className="group border-b border-[#1A1A1A] last:border-0" open={count > 0}>
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
              <span className="label-tech text-[11px] uppercase tracking-widest text-[#cfc4c5]">
                {g.cat.es}
                {count > 0 ? ` · ${count}` : ""}
              </span>
              <ChevronDown size={16} className="text-[#c6c6c6] transition-transform group-open:rotate-180" />
            </summary>
            <div className="grid gap-2 px-4 pb-4 sm:grid-cols-2">
              {g.items.map((it) => (
                <Check key={it.es} label={it.es} checked={selected.has(it.es)} onChange={() => onToggle(it.es)} />
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
