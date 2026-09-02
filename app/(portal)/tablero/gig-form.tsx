"use client";

/**
 * Form de evento (gig) del productor — crear o editar. Usa las server actions
 * createGig/updateGig (RPC is_org_writer). Estilos Stitch (inputs hairline,
 * labels label-tech, radio 0). Al guardar, vuelve al tablero.
 *
 * La conversión datetime-local <-> ISO ya no vive acá: se mudó a lib/dates.ts
 * (aInputLocal / desdeInputLocal) el 2/9, porque el formulario de oferta tenía
 * que hacer la misma y la estaba salteando. Ver el header de ese archivo.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, CalendarPlus, Plus, X } from "lucide-react";
import { aInputLocal, desdeInputLocal } from "@/lib/dates";
import { createGig, updateGig, setGigDetails, setGigSlots, geocodeAddress } from "./gig-actions";

export interface GigInitial {
  id: string;
  title: string | null;
  starts_at: string | null;
  ends_at: string | null;
  venue_name: string | null;
  client_budget: number | null;
  venue_address: string | null;
  venue_lat: number | null;
  venue_lng: number | null;
  slots?: { role: string; quantity: number }[];
}

const labelCls = "block mb-2 label-tech text-[11px] uppercase tracking-[0.1em] text-[#cfc4c5]";
const inputCls =
  "w-full bg-transparent border-0 border-b border-[#4c4546] focus:border-[#e5e2e1] outline-none text-[16px] text-[#e5e2e1] py-3 px-0 rounded-none transition-colors placeholder:text-[#8a8a8a] [color-scheme:dark]";

export function GigForm({ initial }: { initial?: GigInitial }) {
  const router = useRouter();
  const editing = Boolean(initial);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    title: initial?.title ?? "",
    startsAt: aInputLocal(initial?.starts_at ?? null),
    endsAt: aInputLocal(initial?.ends_at ?? null),
    venue: initial?.venue_name ?? "",
    address: initial?.venue_address ?? "",
    budget: initial?.client_budget != null ? String(initial.client_budget) : "",
  });
  // Dotación requerida: filas {rol, cantidad} (cantidad como string editable).
  const [slots, setSlots] = useState<{ role: string; qty: string }[]>(
    initial?.slots?.map((s) => ({ role: s.role, qty: String(s.quantity) })) ?? [],
  );
  const addSlot = () => setSlots((s) => [...s, { role: "", qty: "1" }]);
  const removeSlot = (i: number) => setSlots((s) => s.filter((_, idx) => idx !== i));
  const setSlot = (i: number, k: "role" | "qty", v: string) =>
    setSlots((s) => s.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));

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
      startsAt: desdeInputLocal(f.startsAt),
      endsAt: desdeInputLocal(f.endsAt),
      venue: f.venue.trim(),
    };
    try {
      const res = editing ? await updateGig(initial!.id, payload) : await createGig(payload);
      if (!res.ok) {
        toast.error(res.reason || "No se pudo guardar");
        return;
      }
      // Extras del gig (ingreso del cliente + ubicación). El monto se limpia a
      // número; la ubicación se preserva de lo que ya había (el geocode la setea
      // en su paso). Un fallo acá no tumba el guardado del evento, solo avisa.
      const gigId = editing ? initial!.id : (res as { gigId?: string }).gigId;
      const budgetNum = f.budget.trim() ? Number(f.budget.replace(/[^\d.]/g, "")) : null;
      if (gigId) {
        // Geocodifico la dirección para el geofencing del fichaje (OSM, gratis).
        const addr = f.address.trim();
        const geo = addr ? await geocodeAddress(addr) : null;
        const det = await setGigDetails(gigId, {
          clientBudget: budgetNum != null && !Number.isNaN(budgetNum) ? budgetNum : null,
          venueLat: geo?.lat ?? null,
          venueLng: geo?.lng ?? null,
          venueAddress: addr || null,
        });
        if (!det.ok) toast.error(det.reason || "El evento se guardó, pero los datos extra no.");
        else if (addr && !geo) {
          toast.error("Guardé la dirección, pero no pude ubicarla en el mapa. Revisá que esté completa (calle, número, ciudad).");
        }
        const sl = await setGigSlots(
          gigId,
          slots.map((s) => ({ role: s.role, quantity: Number(s.qty.replace(/[^\d]/g, "")) || 0 })),
        );
        if (!sl.ok) toast.error(sl.reason || "El evento se guardó, pero la dotación no.");
      }
      toast.success(editing ? "Evento actualizado" : "Evento creado");
      router.push("/tablero");
      router.refresh();
    } catch {
      toast.error("No se pudo guardar. Probá de nuevo.");
    } finally {
      setSaving(false);
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
        <h1 className="t-display text-[#e5e2e1] uppercase">
          {editing ? "Editar" : "Crear evento"}
        </h1>
        <p className="text-[15px] text-[#cfc4c5] mt-4 max-w-[520px] leading-[1.6]">
          Cargá el evento y después buscale el staff desde el tablero.
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-10">
        <div>
          <label htmlFor="gig-title" className={labelCls}>Nombre del evento</label>
          <input id="gig-title" className={inputCls} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Ej: Fiesta de fin de año" autoFocus />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label htmlFor="gig-starts" className={labelCls}>Arranca</label>
            <input id="gig-starts" type="datetime-local" className={inputCls} value={f.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
          </div>
          <div>
            <label htmlFor="gig-ends" className={labelCls}>Termina (opcional)</label>
            <input id="gig-ends" type="datetime-local" className={inputCls} value={f.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="gig-venue" className={labelCls}>Lugar</label>
          <input id="gig-venue" className={inputCls} value={f.venue} onChange={(e) => set("venue", e.target.value)} placeholder="Ej: Salón Central, CABA" />
        </div>
        <div>
          <label htmlFor="gig-address" className={labelCls}>Dirección del predio (opcional, para el fichaje por GPS)</label>
          <input id="gig-address" className={inputCls} value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Ej: Av. Corrientes 1234, CABA" />
          <p className="mt-2 text-[13px] text-[#8a8a8a] leading-[1.5]">
            Si la cargás, cuando el staff fiche te aviso si lo hizo cerca del lugar o lejos. Poné calle, número y ciudad.
          </p>
        </div>
        <div>
          <label htmlFor="gig-budget" className={labelCls}>Ingreso del cliente (opcional)</label>
          <input
            id="gig-budget"
            inputMode="numeric"
            className={inputCls}
            value={f.budget}
            onChange={(e) => set("budget", e.target.value)}
            placeholder="Ej: 800000"
          />
          <p className="mt-2 text-[13px] text-[#8a8a8a] leading-[1.5]">
            Lo que le cobrás al cliente por este evento. Sirve para calcular tu margen en Rentabilidad (ingreso menos costo del staff). No se comparte con el staff.
          </p>
        </div>
        <div>
          <label className={labelCls}>Dotación requerida (opcional)</label>
          <p className="mb-4 text-[13px] text-[#8a8a8a] leading-[1.5]">
            Declará cuántas personas necesitás por rol. El tablero te muestra cuántos puestos te faltan cubrir.
          </p>
          <div className="flex flex-col gap-3">
            {slots.map((row, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-1">
                  <input
                    className={inputCls}
                    value={row.role}
                    onChange={(e) => setSlot(i, "role", e.target.value)}
                    placeholder="Rol (ej: Bartender)"
                    aria-label="Rol del puesto"
                  />
                </div>
                <div className="w-20 shrink-0">
                  <input
                    className={`${inputCls} text-center`}
                    inputMode="numeric"
                    value={row.qty}
                    onChange={(e) => setSlot(i, "qty", e.target.value)}
                    placeholder="Cant."
                    aria-label="Cantidad"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeSlot(i)}
                  aria-label="Quitar puesto"
                  className="shrink-0 text-[#8a8a8a] hover:text-[#ffb4ab] transition-colors p-2"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addSlot}
              className="inline-flex items-center gap-2 self-start label-tech text-[11px] uppercase tracking-widest text-[#cfc4c5] hover:text-[#e5e2e1] border border-[#4c4546] hover:border-[#c6c6c6] px-4 py-2 transition-colors"
            >
              <Plus size={14} /> Agregar puesto
            </button>
          </div>
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
