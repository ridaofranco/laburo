"use client";

/**
 * Form de edición del propio perfil de staff. Prefill con los datos reales del
 * perfil; guarda vía la server action updateMyStaffProfile (RPC self-scoped).
 * Nombre/apellido/email son identidad (solo lectura). Estilos Stitch: inputs
 * hairline bottom-border, labels label-tech, radio 0. Toda la lógica preservada.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { updateMyStaffProfile } from "./actions";
import type { StaffProfile } from "@/lib/staff";

const labelCls = "block mb-2 label-tech text-[11px] uppercase tracking-[0.1em] text-[#cfc4c5]";
const inputCls =
  "w-full bg-transparent border-0 border-b border-[#4c4546] focus:border-[#e5e2e1] outline-none text-[16px] text-[#e5e2e1] py-3 px-0 rounded-none transition-colors placeholder:text-[#565656]";

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between gap-4 border px-4 py-3 transition-colors ${
        checked ? "border-[#c6c6c6] text-[#e5e2e1]" : "border-[#4c4546] text-[#cfc4c5]"
      }`}
    >
      <span className="text-[14px]">{label}</span>
      <span
        className={`w-5 h-5 border grid place-items-center text-[11px] ${
          checked ? "bg-[#c6c6c6] border-[#c6c6c6] text-black" : "border-[#4c4546]"
        }`}
      >
        {checked ? "✓" : ""}
      </span>
    </button>
  );
}

export function EditProfileForm({ profile }: { profile: StaffProfile }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    telefono: profile.telefono ?? "",
    provincia: profile.provincia ?? "",
    ciudad: profile.ciudad ?? "",
    oficios: (profile.oficios ?? []).join(", "),
    oficios_otro: profile.oficios_otro ?? "",
    disponibilidad_aviso: profile.disponibilidad_aviso ?? "",
    disponibilidad_finde: profile.disponibilidad_finde ?? false,
    disponibilidad_viajar: profile.disponibilidad_viajar ?? false,
    movilidad_propia: profile.movilidad_propia ?? false,
    experiencia_detalle: profile.experiencia_detalle ?? "",
    anios_experiencia: profile.anios_experiencia ?? "",
    linkedin_url: profile.linkedin_url ?? "",
    portfolio_url: profile.portfolio_url ?? "",
    motivacion: profile.motivacion ?? "",
  });

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const res = await updateMyStaffProfile({
      telefono: f.telefono.trim(),
      provincia: f.provincia.trim(),
      ciudad: f.ciudad.trim(),
      oficios: f.oficios.split(",").map((s) => s.trim()).filter(Boolean),
      oficios_otro: f.oficios_otro.trim(),
      disponibilidad_aviso: f.disponibilidad_aviso.trim(),
      disponibilidad_finde: f.disponibilidad_finde,
      disponibilidad_viajar: f.disponibilidad_viajar,
      movilidad_propia: f.movilidad_propia,
      experiencia_detalle: f.experiencia_detalle.trim(),
      anios_experiencia: f.anios_experiencia.trim(),
      linkedin_url: f.linkedin_url.trim(),
      portfolio_url: f.portfolio_url.trim(),
      motivacion: f.motivacion.trim(),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Perfil actualizado");
      router.refresh();
    } else {
      toast.error(res.reason || "No se pudo guardar");
    }
  }

  const nombre = [profile.nombre, profile.apellido].filter(Boolean).join(" ").trim() || "Sin nombre";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-12">
      {/* Identidad (solo lectura) */}
      <section className="flex flex-col gap-2 border-b border-[#4c4546] pb-8">
        <span className={labelCls}>Tu cuenta</span>
        <p className="font-[family-name:var(--font-syne)] text-[28px] font-semibold text-[#e5e2e1] uppercase">
          {nombre}
        </p>
        <p className="text-[14px] text-[#cfc4c5]">{profile.email}</p>
      </section>

      {/* Contacto y ubicación */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <label className={labelCls}>Teléfono</label>
          <input className={inputCls} value={f.telefono} onChange={(e) => set("telefono", e.target.value)} placeholder="Ej: 11 2345 6789" />
        </div>
        <div>
          <label className={labelCls}>Disponibilidad (aviso)</label>
          <input className={inputCls} value={f.disponibilidad_aviso} onChange={(e) => set("disponibilidad_aviso", e.target.value)} placeholder="Ej: Inmediata, 1 semana" />
        </div>
        <div>
          <label className={labelCls}>Provincia</label>
          <input className={inputCls} value={f.provincia} onChange={(e) => set("provincia", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Ciudad</label>
          <input className={inputCls} value={f.ciudad} onChange={(e) => set("ciudad", e.target.value)} />
        </div>
      </section>

      {/* Oficios */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <label className={labelCls}>Oficios (separados por coma)</label>
          <input className={inputCls} value={f.oficios} onChange={(e) => set("oficios", e.target.value)} placeholder="Ej: Mozo, Seguridad, Sonido" />
        </div>
        <div>
          <label className={labelCls}>Otro oficio</label>
          <input className={inputCls} value={f.oficios_otro} onChange={(e) => set("oficios_otro", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Años de experiencia</label>
          <input className={inputCls} value={f.anios_experiencia} onChange={(e) => set("anios_experiencia", e.target.value)} placeholder="Ej: 3" />
        </div>
      </section>

      {/* Disponibilidad (toggles) */}
      <section className="flex flex-col gap-3">
        <span className={labelCls}>Disponibilidad</span>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Toggle label="Findes de semana" checked={f.disponibilidad_finde} onChange={(v) => set("disponibilidad_finde", v)} />
          <Toggle label="Puedo viajar" checked={f.disponibilidad_viajar} onChange={(v) => set("disponibilidad_viajar", v)} />
          <Toggle label="Movilidad propia" checked={f.movilidad_propia} onChange={(v) => set("movilidad_propia", v)} />
        </div>
      </section>

      {/* Experiencia y links */}
      <section className="flex flex-col gap-8">
        <div>
          <label className={labelCls}>Experiencia (detalle)</label>
          <textarea className={`${inputCls} resize-none`} rows={3} value={f.experiencia_detalle} onChange={(e) => set("experiencia_detalle", e.target.value)} placeholder="Contá dónde trabajaste" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className={labelCls}>LinkedIn</label>
            <input className={inputCls} value={f.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label className={labelCls}>Portfolio</label>
            <input className={inputCls} value={f.portfolio_url} onChange={(e) => set("portfolio_url", e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <div>
          <label className={labelCls}>Sobre vos</label>
          <textarea className={`${inputCls} resize-none`} rows={3} value={f.motivacion} onChange={(e) => set("motivacion", e.target.value)} placeholder="Una línea sobre vos" />
        </div>
      </section>

      <div className="flex justify-end border-t border-[#4c4546] pt-8">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center justify-center gap-3 bg-[#e5e2e1] text-black label-tech text-[12px] uppercase tracking-widest px-10 py-5 border border-[#e5e2e1] hover:bg-transparent hover:text-[#e5e2e1] transition-colors disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
