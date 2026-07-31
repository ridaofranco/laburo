import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { oficioColor, initials } from "@/lib/avatar-color";

/** Columnas de card (payload chico). */
export interface StaffCard {
  id: string;
  nombre: string | null;
  apellido: string | null;
  oficios: string[] | null;
  oficios_otro: string | null;
  provincia: string | null;
  ciudad: string | null;
  experiencia: boolean | null;
  // anios_experiencia es TEXT en la DB: rangos como "0–1","3–5","10+" (los que
  // escribe el form real). Antes tipado como number → "3–5" > 0 = NaN, el chip
  // no se mostraba nunca para los registrados por el formulario nuevo.
  anios_experiencia: string | null;
  eventos_trabajados: number | null;
}

/** Señal de experiencia: omitir si false/null. */
function experienceLabel(c: StaffCard): string | null {
  if (c.eventos_trabajados && c.eventos_trabajados > 0) {
    return `${c.eventos_trabajados} ${c.eventos_trabajados === 1 ? "evento" : "eventos"}`;
  }
  const anios = (c.anios_experiencia ?? "").trim();
  if (anios) return `${anios} ${anios === "1" ? "año" : "años"}`;
  if (c.experiencia === true) return "Con experiencia";
  return null;
}

/**
 * Tarjeta de candidato — porteo del grid-card de "Buscar Staff" de Stitch.
 * El pool no tiene fotos, así que el área superior (aspect 3/4) usa el avatar
 * de iniciales sobre un tono del oficio, en vez de la foto del mockup.
 */
export function CandidateCard({ candidate }: { candidate: StaffCard }) {
  const c = candidate;
  const nombre = [c.nombre, c.apellido].filter(Boolean).join(" ").trim() || "Sin nombre";
  const primary = c.oficios?.[0] ?? "";
  const tags = (c.oficios ?? []).filter(Boolean);
  const shown = tags.slice(0, 3);
  const overflow = tags.length - shown.length;
  const loc = [c.ciudad, c.provincia].filter(Boolean).join(", ");
  const exp = experienceLabel(c);
  const color = oficioColor(primary);

  return (
    <Link
      href={`/staff/${c.id}`}
      className="group border border-[#1A1A1A] bg-[#0A0A0A] overflow-hidden hover:border-[#F5F5F5] transition-colors duration-300 flex flex-col h-full"
    >
      {/* Área superior: avatar de iniciales (reemplaza la foto del mockup) */}
      <div
        className="aspect-[3/4] w-full relative border-b border-[#1A1A1A] grid place-items-center overflow-hidden"
        style={{ backgroundColor: `${color}14` }}
      >
        <span
          aria-hidden="true"
          className="t-stat-sm"
          style={{ color }}
        >
          {initials(c.nombre, c.apellido)}
        </span>
        {exp && (
          <div className="absolute top-4 right-4 bg-black border border-[#4c4546] px-2 py-1">
            <span className="label-tech text-[10px] text-[#e5e2e1]">{exp}</span>
          </div>
        )}
      </div>

      <div className="p-6 flex flex-col gap-2 flex-1">
        <div className="flex justify-between items-start gap-2">
          <h3 className="font-[family-name:var(--font-syne)] text-[26px] leading-[1.05] font-semibold uppercase text-[#e5e2e1] break-words min-w-0">
            {nombre}
          </h3>
          <ArrowUpRight size={20} className="text-[#cfc4c5] shrink-0 group-hover:text-[#F5F5F5] transition-colors" />
        </div>
        {primary && (
          <p className="label-tech text-[11px] text-[#cfc4c5] border-b border-[#4c4546] pb-4 mb-1">
            {primary}
          </p>
        )}
        {loc && (
          <p className="text-[13px] text-[#cfc4c5] flex items-center gap-1.5">
            <MapPin size={13} className="shrink-0" />
            <span className="truncate">{loc}</span>
          </p>
        )}
        {shown.length > 0 && (
          <div className="mt-auto pt-4 flex gap-2 flex-wrap">
            {shown.map((t) => (
              <span key={t} className="text-[10px] label-tech border border-[#1A1A1A] px-2 py-1 text-[#cfc4c5]">
                {t}
              </span>
            ))}
            {overflow > 0 && (
              <span className="text-[10px] label-tech border border-[#1A1A1A] px-2 py-1 text-[#cfc4c5]">
                +{overflow}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
