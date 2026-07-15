/**
 * Perfil del candidato (PERF-01), server component.
 *
 * Trae UNA fila de public.staff_app_profiles (vista security_invoker) con
 * `.eq('id', id).maybeSingle()`. La RLS la scopea a miembros: un no-miembro o
 * un id inexistente devuelve null → notFound(). El (app) layout ya bloquea a
 * no-miembros antes de llegar acá (defensa en profundidad).
 *
 * Regla de null-safety (UI-SPEC): OMITIR toda fila cuyo valor sea null/vacío;
 * nunca una fila vacía ni un false/0 como badge negativo. portfolio/linkedin
 * sólo se renderizan como link si el valor es una URL http(s) real (el pool
 * tiene texto libre como "No tengo" en esas columnas).
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { oficioColor, initials } from "@/lib/avatar-color";
import { isHttpUrl, classifyCv } from "@/lib/cv";
import { QuickActions } from "./quick-actions";
import { CvView } from "./cv-view";

const PROFILE_COLUMNS =
  "id,nombre,apellido,oficios,oficios_otro,provincia,ciudad,experiencia,anios_experiencia,eventos_trabajados,experiencia_detalle,disponibilidad_finde,disponibilidad_viajar,movilidad_propia,disponibilidad_aviso,estado,cv_url,portfolio_url,linkedin_url,telefono,email,situacion_legal,donde_trabajar,pais_residencia,motivacion";

interface Profile {
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
  experiencia_detalle: string | null;
  disponibilidad_finde: boolean | null;
  disponibilidad_viajar: boolean | null;
  movilidad_propia: boolean | null;
  disponibilidad_aviso: string | null;
  estado: string | null;
  cv_url: string | null;
  portfolio_url: string | null;
  linkedin_url: string | null;
  telefono: string | null;
  email: string | null;
  situacion_legal: string | null;
  donde_trabajar: string[] | null; // text[] en el schema (verificado en vivo)
  pais_residencia: string | null;
  motivacion: string | null;
}

/** Bloque de sección con título 20/600, se omite si no hay children. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-sm">
      <h2 className="text-heading font-semibold text-fg">{title}</h2>
      {children}
    </section>
  );
}

/** Fila etiqueta/valor. Devuelve null si el valor está vacío (null-safety). */
function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  const v = (value ?? "").trim();
  if (!v) return null;
  return (
    <div className="flex flex-col gap-xs">
      <span className="text-label font-semibold text-fg-muted">{label}</span>
      <span className="text-body text-fg whitespace-pre-line">{v}</span>
    </div>
  );
}

function experienceLine(p: Profile): string | null {
  const parts: string[] = [];
  if (p.eventos_trabajados && p.eventos_trabajados > 0) {
    parts.push(`${p.eventos_trabajados} ${p.eventos_trabajados === 1 ? "evento" : "eventos"}`);
  }
  if (p.anios_experiencia && p.anios_experiencia > 0) {
    parts.push(`${p.anios_experiencia} ${p.anios_experiencia === 1 ? "año" : "años"} de experiencia`);
  }
  if (parts.length) return parts.join(" · ");
  if (p.experiencia === true) return "Con experiencia";
  return null;
}

/** Link externo con icono; se omite si el valor no es una URL http(s) real. */
function ExternalRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!isHttpUrl(value)) return null;
  return (
    <a
      href={value!.trim()}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-xs min-h-[44px] text-accent text-body"
    >
      <ExternalLink size={18} aria-hidden="true" className="shrink-0" />
      <span className="truncate">{label}</span>
    </a>
  );
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("staff_app_profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const p = data as Profile;

  const nombreCompleto =
    [p.nombre, p.apellido].filter(Boolean).join(" ").trim() || "Sin nombre";
  const primary = p.oficios?.[0] ?? "";
  const oficios = (p.oficios ?? []).filter(Boolean);
  const loc = [p.ciudad, p.provincia].filter(Boolean).join(", ");
  const estado = (p.estado ?? "").trim();
  const expLine = experienceLine(p);

  const dispPills: string[] = [];
  if (p.disponibilidad_finde === true) dispPills.push("Disponible el finde");
  if (p.disponibilidad_viajar === true) dispPills.push("Dispuesto a viajar");
  if (p.movilidad_propia === true) dispPills.push("Movilidad propia");

  const hasExperiencia = Boolean(expLine || (p.experiencia_detalle ?? "").trim());
  const hasDisponibilidad = dispPills.length > 0 || Boolean((p.disponibilidad_aviso ?? "").trim());
  const dondeTrabajar = (p.donde_trabajar ?? []).filter(Boolean).join(", ");
  const hasSituacion = Boolean(
    (p.situacion_legal ?? "").trim() ||
      dondeTrabajar ||
      (p.pais_residencia ?? "").trim(),
  );
  const hasLinks =
    isHttpUrl(p.portfolio_url) || isHttpUrl(p.linkedin_url);
  const cv = classifyCv(p.cv_url);

  return (
    <div className="flex flex-col gap-lg pb-lg">
      {/* Volver */}
      <Link
        href="/"
        className="inline-flex items-center gap-xs min-h-[44px] -ml-1 text-fg-muted text-label font-semibold"
      >
        <ChevronLeft size={18} aria-hidden="true" />
        Volver
      </Link>

      {/* Header: avatar 56px + nombre + estado + ubicación */}
      <header className="flex items-start gap-md">
        <span
          aria-hidden="true"
          className="shrink-0 grid place-items-center w-14 h-14 rounded-full text-heading font-semibold text-fg"
          style={{ backgroundColor: oficioColor(primary) }}
        >
          {initials(p.nombre, p.apellido)}
        </span>
        <div className="flex-1 min-w-0 flex flex-col gap-xs">
          <h1 className="text-heading font-semibold text-fg">{nombreCompleto}</h1>
          <div className="flex flex-wrap items-center gap-sm">
            {estado && (
              <span className="rounded-full bg-surface-2 text-fg-muted text-label font-semibold px-sm py-xs capitalize">
                {estado}
              </span>
            )}
            {loc && <span className="text-label font-normal text-fg-muted">{loc}</span>}
          </div>
        </div>
      </header>

      {/* Oficios */}
      {oficios.length > 0 && (
        <Section title="Oficios">
          <div className="flex flex-wrap gap-xs">
            {oficios.map((oficio) => {
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
          </div>
          <InfoRow label="Otro oficio" value={p.oficios_otro} />
        </Section>
      )}

      {/* Experiencia */}
      {hasExperiencia && (
        <Section title="Experiencia">
          {expLine && <p className="text-body text-fg">{expLine}</p>}
          <InfoRow label="Detalle" value={p.experiencia_detalle} />
        </Section>
      )}

      {/* Disponibilidad */}
      {hasDisponibilidad && (
        <Section title="Disponibilidad">
          {dispPills.length > 0 && (
            <div className="flex flex-wrap gap-xs">
              {dispPills.map((label) => (
                <span
                  key={label}
                  className="rounded-full bg-surface-2 text-fg text-label font-semibold px-sm py-xs"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
          <InfoRow label="Aviso de disponibilidad" value={p.disponibilidad_aviso} />
        </Section>
      )}

      {/* Situación / alcance */}
      {hasSituacion && (
        <Section title="Situación">
          <InfoRow label="Situación legal" value={p.situacion_legal} />
          <InfoRow label="Dónde puede trabajar" value={dondeTrabajar} />
          <InfoRow label="País de residencia" value={p.pais_residencia} />
        </Section>
      )}

      {/* Motivación */}
      {(p.motivacion ?? "").trim() && (
        <Section title="Motivación">
          <p className="text-body text-fg whitespace-pre-line">{p.motivacion!.trim()}</p>
        </Section>
      )}

      {/* CV (PERF-02): visor híbrido bucket firmado / Drive preview + Abrir CV.
          Se omite la sección entera sólo si no hay cv_url (null-safety). */}
      {cv.kind !== "none" && (
        <Section title="CV">
          <CvView classification={cv} />
        </Section>
      )}

      {/* Links (portfolio / linkedin): sólo URLs http(s) reales */}
      {hasLinks && (
        <Section title="Links">
          <ExternalRow label="Portfolio" value={p.portfolio_url} />
          <ExternalRow label="LinkedIn" value={p.linkedin_url} />
        </Section>
      )}

      {/* Acciones rápidas (sólo si hay teléfono) */}
      {(p.telefono ?? "").trim() && (
        <QuickActions telefono={p.telefono!.trim()} nombre={p.nombre} />
      )}
    </div>
  );
}
