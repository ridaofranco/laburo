"use client";

/**
 * Piezas COMPARTIDAS entre el registro (/sumate) y el editor de perfil del staff.
 * Un solo producto: los mismos campos, opciones, estilos y el mismo autollenado
 * con IA (parse-cv) en las dos aristas. Evita drift entre somosder.ar y la app.
 */

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

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
 * ── LOS DOS TECHOS DEL CV, ESCRITOS UNA SOLA VEZ (6/8) ──────────────────────
 *
 * Los dos existían y ninguno estaba declarado, así que la pantalla los cruzaba
 * a ciegas y fallaba sin poder explicar nada. Franco, textual: *"no lee los
 * pdfs y tampoco te deja enviar, se rompió todo, no entiendo que poronga pasa"*.
 *
 * 1. ADJUNTAR (`CV_MAX_ADJUNTAR`): el archivo viaja adentro de un Server
 *    Action. Next topea eso (ahora en 4 MB, ver next.config.ts) y Vercel corta
 *    el body de la función en 4,5 MB. Por arriba de eso el envío muere entero.
 *
 * 2. LEER SOLO (`CV_MAX_LEER`): el parser manda el archivo en base64 por JSON,
 *    y base64 infla ~33%. Verificado contra producción: un PDF de 3,34 MB
 *    genera un body de 4,45 MB y vuelve FUNCTION_PAYLOAD_TOO_LARGE.
 *    3 MB deja margen para el resto del JSON.
 *
 * Por eso son DOS números y no uno: hay una franja (3 a 4 MB) donde el CV se
 * sube perfecto pero no se puede leer solo. Ahí la persona se anota igual y
 * completa a mano, que es infinitamente mejor que rebotarla.
 */
export const CV_MAX_ADJUNTAR = 4 * 1024 * 1024;
export const CV_MAX_LEER = 3 * 1024 * 1024;

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
 */
export type MotivoCv = "formato" | "grande" | "vacio" | "falla" | "nokey";

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

  async function run(file: File, oficios: string[]): Promise<CvParsed | null> {
    setMotivo(null);
    if (!/pdf|image/.test(file.type)) {
      setMotivo("formato");
      setStatus("error");
      return null;
    }
    if (file.size > CV_MAX_LEER) {
      setMotivo("grande");
      setStatus("error");
      return null;
    }
    setStatus("loading");
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result).split(",")[1] || "");
        fr.onerror = rej;
        fr.readAsDataURL(file);
      });
      const r = await fetch("/api/parse-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mime: file.type, data: b64, oficios }),
      });
      if (r.status === 500) {
        const j = await r.json().catch(() => ({}));
        if (j?.error === "no_key") {
          setMotivo("nokey");
          setStatus("nokey");
          return null;
        }
      }
      // 413 lo devuelve la INFRAESTRUCTURA (Vercel corta el body de la función),
      // y el cuerpo es texto plano, no JSON: sin esta rama, el r.json() de abajo
      // tira y el motivo real se perdía adentro del catch genérico.
      if (r.status === 413) {
        setMotivo("grande");
        setStatus("error");
        return null;
      }
      const out = await r.json();
      if (!out.ok) {
        setMotivo(out?.error === "bad_mime" ? "formato" : "falla");
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
      setMotivo("falla");
      setStatus("error");
      return null;
    }
  }

  return { status, motivo, motivoRef, run };
}

/** El mensaje que se le muestra a la persona, según por qué falló. */
export function mensajeCv(motivo: MotivoCv | null): string {
  switch (motivo) {
    case "formato":
      return "Los CV en Word no los podemos leer. Subilo en PDF (desde Word: Archivo, Guardar como, PDF) o completá los datos a mano.";
    case "grande":
      return "Tu CV es muy grande para leerlo solo. Se sube igual: completá tu nombre y tu mail y listo.";
    case "vacio":
      return "Tu CV se subió bien, pero no pudimos sacarle los datos (suele pasar cuando es una foto escaneada). Completalos a mano y ya quedás anotado.";
    case "nokey":
      return "El autocompletado no está disponible ahora. Completá los datos a mano y ya quedás anotado.";
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
