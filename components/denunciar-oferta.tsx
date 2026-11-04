"use client";

/**
 * Botón «Denunciar esta oferta» (Franco 31/10). Abre un formulario corto con el
 * motivo y un detalle opcional. La acción la pasa la pantalla que lo usa (lista
 * de trabajos o la oferta por link), porque cada una identifica la oferta a su
 * manera.
 */

import { useState } from "react";
import { Flag } from "lucide-react";

const MOTIVOS: { v: string; t: string }[] = [
  { v: "pide_plata", t: "Me piden plata para trabajar o postularme" },
  { v: "discrimina", t: "Discrimina (edad, sexo, apariencia, nacionalidad u otro)" },
  { v: "falsa", t: "Parece falsa o engañosa" },
  { v: "ilegal", t: "Trabajo ilegal, en negro o con menores" },
  { v: "otro", t: "Otro motivo" },
];

export function DenunciarOferta({
  onDenunciar,
  className = "",
  color = "text-[#988e90] hover:text-[#e5e2e1]",
}: {
  onDenunciar: (motivo: string, detalle: string) => Promise<{ ok: boolean; error?: string }>;
  className?: string;
  color?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "listo" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (estado === "listo") {
    return (
      <p role="status" className={`text-[13px] leading-[1.5] ${color} ${className}`}>
        Gracias, recibimos la denuncia. Si la oferta pide plata o discrimina la damos de baja
        apenas la vemos; el resto lo revisamos en 48 a 72 h.
      </p>
    );
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={`inline-flex items-center gap-2 min-h-[44px] label-tech text-[11px] uppercase tracking-widest underline underline-offset-4 w-fit ${color} ${className}`}
      >
        <Flag size={14} aria-hidden="true" /> Denunciar esta oferta
      </button>
    );
  }

  async function enviar() {
    if (!motivo) {
      setError("Elegí un motivo.");
      return;
    }
    setEstado("enviando");
    setError(null);
    try {
      const r = await onDenunciar(motivo, detalle);
      if (r.ok) setEstado("listo");
      else {
        setEstado("error");
        setError(r.error ?? "No se pudo mandar. Probá de nuevo.");
      }
    } catch {
      setEstado("error");
      setError("No se pudo mandar. Probá de nuevo.");
    }
  }

  return (
    <fieldset className={`flex flex-col gap-3 border border-[#4c4546] p-4 w-full max-w-[560px] ${className}`}>
      <legend className={`px-1 label-tech text-[11px] uppercase tracking-widest ${color}`}>
        Denunciar esta oferta
      </legend>
      {MOTIVOS.map((m) => (
        <label key={m.v} className={`flex items-start gap-3 text-[14px] leading-[1.45] cursor-pointer ${color}`}>
          <input
            type="radio"
            name="motivo-denuncia"
            value={m.v}
            checked={motivo === m.v}
            onChange={() => {
              setMotivo(m.v);
              setError(null);
            }}
            className="mt-1 h-4 w-4 shrink-0"
          />
          <span className="break-words">{m.t}</span>
        </label>
      ))}
      <textarea
        value={detalle}
        onChange={(e) => setDetalle(e.target.value.slice(0, 500))}
        rows={3}
        placeholder="Contanos qué pasó (opcional)"
        className="w-full bg-transparent border border-[#4c4546] p-3 text-[15px] rounded-none"
      />
      {error ? <p role="alert" className="text-[13px] text-[#e57373]">{error}</p> : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={enviar}
          disabled={estado === "enviando"}
          className="min-h-[44px] px-5 label-tech text-[11px] uppercase tracking-widest border border-current disabled:opacity-50"
        >
          {estado === "enviando" ? "Mandando…" : "Mandar denuncia"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className={`min-h-[44px] px-3 label-tech text-[11px] uppercase tracking-widest ${color}`}
        >
          Cancelar
        </button>
      </div>
    </fieldset>
  );
}
