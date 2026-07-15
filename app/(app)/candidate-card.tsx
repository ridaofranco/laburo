import Link from "next/link";
import { MapPin } from "lucide-react";
import { oficioColor, initials } from "@/lib/avatar-color";

/** Columnas de card (NO motivacion/experiencia_detalle — payload chico, T-02-12). */
export interface StaffCard {
  id: string;
  nombre: string | null;
  apellido: string | null;
  oficios: string[] | null;
  oficios_otro: string | null;
  provincia: string | null;
  ciudad: string | null;
  experiencia: boolean | null;
  anios_experiencia: number | null;
  eventos_trabajados: number | null;
}

/** Señal de experiencia (D-03): omitir si false/null — nunca "0 eventos". */
function experienceLabel(c: StaffCard): string | null {
  if (c.eventos_trabajados && c.eventos_trabajados > 0) {
    return `${c.eventos_trabajados} ${c.eventos_trabajados === 1 ? "evento" : "eventos"}`;
  }
  if (c.anios_experiencia && c.anios_experiencia > 0) {
    return `${c.anios_experiencia} ${c.anios_experiencia === 1 ? "año" : "años"}`;
  }
  if (c.experiencia === true) return "Con experiencia";
  return null;
}

/**
 * Tarjeta de candidato (D-03): simple, rápida, legible. Sin foto, sin glow.
 * Toda la card es un tap target >=44px que abre el perfil.
 * Superficie: bg-surface-1 (= #141B31), borde #2A3455, radio 16px, padding 16px.
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

  return (
    <Link
      href={`/staff/${c.id}`}
      className="block rounded-2xl bg-surface-1 border border-border p-md min-h-[44px] transition-transform active:scale-[0.99]"
    >
      {/* Row 1: avatar + nombre + señal de experiencia */}
      <div className="flex items-center gap-sm">
        <span
          aria-hidden="true"
          className="shrink-0 grid place-items-center w-10 h-10 rounded-full text-label font-semibold text-fg"
          style={{ backgroundColor: oficioColor(primary) }}
        >
          {initials(c.nombre, c.apellido)}
        </span>
        <span className="flex-1 min-w-0 text-body font-semibold text-fg truncate">
          {nombre}
        </span>
        {exp && (
          <span className="shrink-0 rounded-full bg-surface-2 text-fg-muted text-label font-semibold px-sm py-xs">
            {exp}
          </span>
        )}
      </div>

      {/* Row 2: tags de oficios (hasta 3 + overflow) */}
      {shown.length > 0 && (
        <div className="flex flex-wrap gap-xs mt-sm">
          {shown.map((oficio) => {
            const color = oficioColor(oficio);
            return (
              <span
                key={oficio}
                className="rounded-full text-label font-semibold px-sm py-xs"
                style={{ backgroundColor: `${color}24`, color }}
              >
                {oficio}
              </span>
            );
          })}
          {overflow > 0 && (
            <span className="rounded-full bg-surface-2 text-fg-muted text-label font-semibold px-sm py-xs">
              +{overflow}
            </span>
          )}
        </div>
      )}

      {/* Row 3: ubicación */}
      {loc && (
        <div className="flex items-center gap-xs mt-sm text-fg-muted">
          <MapPin size={16} aria-hidden="true" className="shrink-0" />
          <span className="text-label font-normal truncate">{loc}</span>
        </div>
      )}
    </Link>
  );
}
