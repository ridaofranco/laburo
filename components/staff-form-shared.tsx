"use client";

/**
 * Piezas COMPARTIDAS entre el registro (/sumate) y el editor de perfil del staff.
 * Un solo producto: los mismos campos, opciones, estilos y el mismo autollenado
 * con IA (parse-cv) en las dos aristas. Evita drift entre somosder.ar y la app.
 */

import { useState } from "react";
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

export const labelCls =
  "block mb-2 label-tech text-[11px] uppercase tracking-[0.1em] text-[#cfc4c5]";
export const inputCls =
  "w-full bg-transparent border-0 border-b border-[#4c4546] focus:border-[#e5e2e1] outline-none text-[16px] text-[#e5e2e1] py-3 px-0 rounded-none transition-colors placeholder:text-[#565656] [color-scheme:dark]";
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
    <label className="flex items-center gap-3 border border-[#4c4546] px-4 py-3 cursor-pointer hover:border-[#c6c6c6] transition-colors">
      <span
        className={`w-5 h-5 border grid place-items-center text-[11px] shrink-0 ${
          checked ? "bg-[#c6c6c6] border-[#c6c6c6] text-black" : "border-[#4c4546]"
        }`}
      >
        {checked ? "✓" : ""}
      </span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
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
export function useCvAutofill() {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error" | "nokey">("idle");

  async function run(file: File, oficios: string[]): Promise<CvParsed | null> {
    if (!/pdf|image/.test(file.type)) {
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
          setStatus("nokey");
          return null;
        }
      }
      const out = await r.json();
      if (!out.ok) throw new Error("parse");
      setStatus("ok");
      return (out.data ?? {}) as CvParsed;
    } catch {
      setStatus("error");
      return null;
    }
  }

  return { status, run };
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
