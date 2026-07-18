"use client";

/**
 * Form de evento (gig) del productor — crear o editar. Usa las server actions
 * createGig/updateGig (RPC is_org_writer). datetime-local <-> ISO. Estilos Stitch
 * (inputs hairline, labels label-tech, radio 0). Al guardar, vuelve al tablero.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, CalendarPlus } from "lucide-react";
import { createGig, updateGig } from "./gig-actions";

export interface GigInitial {
  id: string;
  title: string | null;
  starts_at: string | null;
  ends_at: string | null;
  venue_name: string | null;
}

const labelCls = "block mb-2 label-tech text-[11px] uppercase tracking-[0.1em] text-[#cfc4c5]";
const inputCls =
  "w-full bg-transparent border-0 border-b border-[#4c4546] focus:border-[#e5e2e1] outline-none text-[16px] text-[#e5e2e1] py-3 px-0 rounded-none transition-colors placeholder:text-[#565656] [color-scheme:dark]";

/** ISO -> valor para <input datetime-local> en hora local. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** valor datetime-local -> ISO (o null). */
function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function GigForm({ initial }: { initial?: GigInitial }) {
  const router = useRouter();
  const editing = Boolean(initial);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    title: initial?.title ?? "",
    startsAt: toLocalInput(initial?.starts_at ?? null),
    endsAt: toLocalInput(initial?.ends_at ?? null),
    venue: initial?.venue_name ?? "",
  });

  const set = <K extends keyof typeof f>(k: K, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!f.title.trim()) {
      toast.error("Poné un nombre al evento.");
      return;
    }
    setSaving(true);
    const payload = {
      title: f.title.trim(),
      startsAt: fromLocalInput(f.startsAt),
      endsAt: fromLocalInput(f.endsAt),
      venue: f.venue.trim(),
    };
    const res = editing ? await updateGig(initial!.id, payload) : await createGig(payload);
    setSaving(false);
    if (res.ok) {
      toast.success(editing ? "Evento actualizado" : "Evento creado");
      router.push("/tablero");
      router.refresh();
    } else {
      toast.error(res.reason || "No se pudo guardar");
    }
  }

  return (
    <div className="max-w-[720px] mx-auto w-full px-6 md:px-20 py-12 md:py-24">
      <Link
        href="/tablero"
        className="inline-flex items-center gap-2 label-tech text-[12px] text-[#cfc4c5] hover:text-[#e5e2e1] transition-colors mb-8"
      >
        <ArrowLeft size={16} /> Volver al tablero
      </Link>

      <header className="border-b border-[#1A1A1A] pb-6 mb-10">
        <p className="label-tech text-[12px] uppercase tracking-[0.2em] text-[#cfc4c5] mb-3">
          {editing ? "Editar evento" : "Nuevo evento"}
        </p>
        <h1 className="font-[family-name:var(--font-syne)] text-[40px] md:text-[64px] font-extrabold text-[#e5e2e1] tracking-tight leading-none uppercase">
          {editing ? "Editar" : "Crear evento"}
        </h1>
        <p className="text-[15px] text-[#cfc4c5] mt-4 max-w-[520px] leading-[1.6]">
          Cargá el evento y después buscale el staff desde el tablero.
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-10">
        <div>
          <label className={labelCls}>Nombre del evento</label>
          <input className={inputCls} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Ej: Fiesta de fin de año" autoFocus />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className={labelCls}>Arranca</label>
            <input type="datetime-local" className={inputCls} value={f.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Termina (opcional)</label>
            <input type="datetime-local" className={inputCls} value={f.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Lugar</label>
          <input className={inputCls} value={f.venue} onChange={(e) => set("venue", e.target.value)} placeholder="Ej: Salón Central, CABA" />
        </div>

        <div className="flex items-center justify-end gap-4 border-t border-[#1A1A1A] pt-8">
          <Link href="/tablero" className="label-tech text-[12px] text-[#cfc4c5] hover:text-[#e5e2e1] uppercase tracking-widest px-6 py-4 transition-colors">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-3 bg-[#e5e2e1] text-black label-tech text-[12px] uppercase tracking-widest px-10 py-4 border border-[#e5e2e1] hover:bg-transparent hover:text-[#e5e2e1] transition-colors disabled:opacity-50"
          >
            <CalendarPlus size={16} />
            {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear evento"}
          </button>
        </div>
      </form>
    </div>
  );
}
