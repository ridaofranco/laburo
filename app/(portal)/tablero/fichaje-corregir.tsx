"use client";

/**
 * Corrección a mano del fichaje desde el tablero (0094). Una fila por persona
 * confirmada (haya fichado o no). «Corregir» abre la entrada, la salida y el
 * motivo; lo corregido se marca para que se vea que no lo fichó la persona.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { aInputLocal, desdeInputLocal } from "@/lib/dates";
import { corregirFichaje } from "./gig-actions";

export interface FilaFichaje {
  staffProfileId: string;
  nombre: string;
  entrada: string | null;
  salida: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  distancia: { text: string; lejos: boolean } | null;
  corregido: boolean;
}

const input =
  "w-full bg-transparent border-0 border-b border-[#4c4546] focus:border-[#e5e2e1] outline-none text-[15px] text-[#e5e2e1] py-2 px-0 rounded-none [color-scheme:dark]";

function Fila({ gigId, f }: { gigId: string; f: FilaFichaje }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [entrada, setEntrada] = useState(aInputLocal(f.checkInAt));
  const [salida, setSalida] = useState(aInputLocal(f.checkOutAt));
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);

  async function guardar() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await corregirFichaje({
        gigId,
        staffProfileId: f.staffProfileId,
        checkInAt: desdeInputLocal(entrada),
        checkOutAt: desdeInputLocal(salida),
        motivo,
      });
      if (r.ok) {
        toast.success("Fichaje corregido");
        setAbierto(false);
        router.refresh();
      } else {
        toast.error(r.reason ?? "No se pudo.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="bg-[#131313] border border-[#1A1A1A] px-4 py-3 flex flex-col gap-3">
      {/* flex-wrap (31/10): a 320 la columna de horas se comía el ancho y el
          nombre quedaba en una letra; ahora las horas bajan a otro renglón. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex flex-col min-w-[9rem] flex-1">
          <span className="text-[15px] text-[#e5e2e1] uppercase truncate">{f.nombre}</span>
          {f.distancia && (
            <span className={`label-tech text-[10px] ${f.distancia.lejos ? "text-[#f5a623]" : "text-[#3dd68c]"}`}>
              {f.distancia.lejos ? `lejos del predio (${f.distancia.text})` : `en el lugar (${f.distancia.text})`}
            </span>
          )}
          {f.corregido && <span className="label-tech text-[10px] text-[#988e90]">corregido a mano</span>}
        </div>
        <div className="flex flex-col items-start sm:items-end gap-1">
          <span className="label-tech text-[11px] text-[#cfc4c5]">
            <span className="text-[#3dd68c]">↓ {f.entrada ?? "sin marcar"}</span>
            <span className="mx-2 opacity-40">|</span>
            <span>↑ {f.salida ?? "sin marcar"}</span>
          </span>
          {!abierto && (
            <button
              type="button"
              onClick={() => setAbierto(true)}
              className="label-tech text-[10px] uppercase tracking-widest text-[#cfc4c5] hover:text-[#e5e2e1] underline underline-offset-4"
            >
              Corregir
            </button>
          )}
        </div>
      </div>
      {abierto && (
        <div className="flex flex-col gap-3 border-t border-[#1A1A1A] pt-3">
          <label className="flex flex-col gap-1 label-tech text-[10px] uppercase tracking-[0.1em] text-[#cfc4c5]">
            Entrada
            <input type="datetime-local" className={input} value={entrada} onChange={(e) => setEntrada(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 label-tech text-[10px] uppercase tracking-[0.1em] text-[#cfc4c5]">
            Salida
            <input type="datetime-local" className={input} value={salida} onChange={(e) => setSalida(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 label-tech text-[10px] uppercase tracking-[0.1em] text-[#cfc4c5]">
            Por qué lo corregís
            <input className={input} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: se olvidó de fichar la salida" />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={guardar}
              disabled={busy}
              className="bg-[#e5e2e1] text-black label-tech text-[11px] uppercase tracking-widest px-6 py-3 border border-[#e5e2e1] hover:bg-transparent hover:text-[#e5e2e1] transition-colors disabled:opacity-50"
            >
              {busy ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="label-tech text-[11px] uppercase tracking-widest px-4 py-3 text-[#cfc4c5] hover:text-[#e5e2e1]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export function FichajeCorregir({ gigId, filas }: { gigId: string; filas: FilaFichaje[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {filas.map((f) => (
        <Fila key={f.staffProfileId} gigId={gigId} f={f} />
      ))}
    </ul>
  );
}
