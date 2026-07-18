/**
 * Perfil del candidato (PERF-01), server component — porteo del "Perfil Detalle"
 * de Stitch: nombre monumental + rol, botón "Enviar propuesta", y grilla de 2
 * columnas (Bio/Experiencia/CV/Ofertas/Rating a la izquierda, Métricas/Oficios/
 * Favorito/Acciones a la derecha). Toda la lógica y los datos reales intactos.
 *
 * Regla de null-safety: OMITIR toda fila cuyo valor sea null/vacío. portfolio/
 * linkedin sólo como link si el valor es una URL http(s) real.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ExternalLink, FilePlus2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isHttpUrl, classifyCv } from "@/lib/cv";
import { calcEdad } from "@/lib/dates";
import { QuickActions } from "./quick-actions";
import { CvView } from "./cv-view";
import { OfferStatusList, type OfferRow } from "./offer-status";
import { FavoriteNote } from "./favorite-note";
import { Rating, type RatingGig } from "./rating";

const PROFILE_COLUMNS =
  "id,nombre,apellido,oficios,oficios_otro,provincia,ciudad,experiencia,anios_experiencia,eventos_trabajados,experiencia_detalle,disponibilidad_finde,disponibilidad_viajar,movilidad_propia,disponibilidad_aviso,estado,cv_url,portfolio_url,linkedin_url,telefono,email,documento,fecha_nacimiento,situacion_legal,donde_trabajar,pais_residencia,motivacion";

interface Profile {
  id: string;
  nombre: string | null;
  apellido: string | null;
  oficios: string[] | null;
  oficios_otro: string | null;
  provincia: string | null;
  ciudad: string | null;
  experiencia: boolean | null;
  anios_experiencia: string | null;
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
  documento: string | null;
  fecha_nacimiento: string | null;
  situacion_legal: string | null;
  donde_trabajar: string[] | null;
  pais_residencia: string | null;
  motivacion: string | null;
}

/** Sección con label técnico (Geist mayúsculas) al estilo Stitch. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-[#1A1A1A] pt-6">
      <h2 className="label-tech text-[12px] text-[#cfc4c5]">{title}</h2>
      {children}
    </section>
  );
}

/** Fila etiqueta/valor. Devuelve null si el valor está vacío (null-safety). */
function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  const v = (value ?? "").trim();
  if (!v) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="label-tech text-[11px] text-[#cfc4c5]">{label}</span>
      <span className="text-[16px] leading-[1.6] text-[#e5e2e1] whitespace-pre-line">{v}</span>
    </div>
  );
}

function experienceLine(p: Profile): string | null {
  const parts: string[] = [];
  if (p.eventos_trabajados && p.eventos_trabajados > 0) {
    parts.push(`${p.eventos_trabajados} ${p.eventos_trabajados === 1 ? "evento" : "eventos"}`);
  }
  const anios = (p.anios_experiencia ?? "").trim();
  if (anios) {
    parts.push(`${anios} ${anios === "1" ? "año" : "años"} de experiencia`);
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
      className="flex items-center gap-2 min-h-[44px] text-[#e5e2e1] text-[16px] hover:opacity-70 transition-opacity"
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

  const { data: offersData } = await supabase
    .from("staff_app_offers")
    .select("id,role,gig_id,gig_title,status,expires_at,sent_at,viewed_at,responded_at")
    .eq("staff_profile_id", id)
    .order("sent_at", { ascending: false });
  const offers = (offersData ?? []) as OfferRow[];

  const { data: noteData } = await supabase
    .from("staff_app_candidate_notes")
    .select("is_favorite,note")
    .eq("staff_profile_id", id)
    .maybeSingle();
  const candidateNote = noteData as {
    is_favorite: boolean | null;
    note: string | null;
  } | null;

  const { data: ratingsData } = await supabase
    .from("staff_app_staff_ratings")
    .select("gig_id,score,note")
    .eq("staff_profile_id", id);
  const ratings = (ratingsData ?? []) as {
    gig_id: string | null;
    score: number | null;
    note: string | null;
  }[];

  type RatableOffer = {
    gig_id: string | null;
    gig_title: string | null;
    status: string | null;
  };
  const ratableOffers = (offersData ?? []) as RatableOffer[];
  const ratingByGig = new Map(ratings.map((r) => [r.gig_id, r]));
  const ratableGigs: RatingGig[] = [];
  const seenGigs = new Set<string>();
  for (const o of ratableOffers) {
    if (o.status !== "accepted" || !o.gig_id || seenGigs.has(o.gig_id)) continue;
    seenGigs.add(o.gig_id);
    const r = ratingByGig.get(o.gig_id);
    ratableGigs.push({
      gigId: o.gig_id,
      gigTitle: (o.gig_title ?? "").trim() || "Gig sin título",
      score: r?.score ?? null,
      note: r?.note ?? null,
    });
  }

  const nombreCompleto =
    [p.nombre, p.apellido].filter(Boolean).join(" ").trim() || "Sin nombre";
  const primary = p.oficios?.[0] ?? "";
  const oficios = (p.oficios ?? []).filter(Boolean);
  const loc = [p.ciudad, p.provincia].filter(Boolean).join(", ");
  const estado = (p.estado ?? "").trim();

  // Edad derivada de la fecha de nacimiento (null si no hay o es inválida).
  // calcEdad parsea AAAA-MM-DD como fecha local (evita el corrimiento UTC de
  // new Date("AAAA-MM-DD") en un server UTC).
  const edad = calcEdad(p.fecha_nacimiento);
  const expLine = experienceLine(p);

  const dispPills: string[] = [];
  if (p.disponibilidad_finde === true) dispPills.push("Disponible el finde");
  if (p.disponibilidad_viajar === true) dispPills.push("Dispuesto a viajar");
  if (p.movilidad_propia === true) dispPills.push("Movilidad propia");

  const hasExperiencia = Boolean(expLine || (p.experiencia_detalle ?? "").trim());
  const hasDisponibilidad = dispPills.length > 0 || Boolean((p.disponibilidad_aviso ?? "").trim());
  const dondeTrabajar = (p.donde_trabajar ?? []).filter(Boolean).join(", ");
  const hasSituacion = Boolean(
    (p.situacion_legal ?? "").trim() || dondeTrabajar || (p.pais_residencia ?? "").trim(),
  );
  const hasLinks = isHttpUrl(p.portfolio_url) || isHttpUrl(p.linkedin_url);
  const cv = classifyCv(p.cv_url);

  // Métricas derivadas
  const eventosCount = p.eventos_trabajados ?? 0;
  const ratingScores = ratings
    .map((r) => r.score)
    .filter((s): s is number => typeof s === "number" && s > 0);
  const avgRating = ratingScores.length
    ? ratingScores.reduce((a, b) => a + b, 0) / ratingScores.length
    : null;

  return (
    <div className="max-w-[1440px] mx-auto w-full px-6 md:px-20 py-12 md:py-20 pb-32 md:pb-20">
      <Link
        href="/buscar"
        className="inline-flex items-center gap-2 label-tech text-[11px] text-[#cfc4c5] hover:text-[#e5e2e1] transition-colors mb-10"
      >
        <ChevronLeft size={16} aria-hidden="true" />
        Volver
      </Link>

      {/* Header monumental */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-[#1A1A1A] pb-10">
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-syne)] text-[clamp(2rem,6vw,84px)] font-extrabold leading-[0.95] tracking-tight uppercase text-[#e5e2e1] [overflow-wrap:anywhere]">
            {nombreCompleto}
          </h1>
          <div className="flex flex-wrap items-center gap-4 mt-5">
            {primary && <span className="label-tech text-[12px] text-[#cfc4c5]">{primary}</span>}
            {loc && <span className="text-[14px] text-[#cfc4c5]">{loc}</span>}
            {estado && (
              <span className="label-tech text-[11px] border border-[#4c4546] px-2 py-1 text-[#cfc4c5] capitalize">
                {estado}
              </span>
            )}
          </div>
        </div>
        <Link
          href={`/staff/${id}/oferta`}
          className="shrink-0 bg-[#F5F5F5] text-black border border-[#F5F5F5] hover:bg-transparent hover:text-[#F5F5F5] transition-colors duration-150 label-tech text-[12px] px-8 py-4 flex items-center justify-center gap-3"
        >
          <FilePlus2 size={18} aria-hidden="true" />
          Enviar propuesta
        </Link>
      </header>

      {/* Dos columnas */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-16 mt-12">
        {/* Izquierda */}
        <div className="md:col-span-7 flex flex-col gap-10">
          {/* Contacto y datos (lo que el productor necesita para contratar) */}
          {((p.email ?? "").trim() || (p.telefono ?? "").trim() || (p.documento ?? "").trim() || edad) && (
            <Section title="Contacto y datos">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                <InfoRow label="Email" value={p.email} />
                <InfoRow label="Teléfono / WhatsApp" value={p.telefono} />
                <InfoRow label="DNI / CUIT / pasaporte" value={p.documento} />
                <InfoRow label="Edad" value={edad ? `${edad} años` : null} />
              </div>
            </Section>
          )}

          {(p.motivacion ?? "").trim() && (
            <Section title="Perfil">
              <p className="text-[16px] leading-[1.7] text-[#e5e2e1] whitespace-pre-line">
                {p.motivacion!.trim()}
              </p>
            </Section>
          )}

          {hasExperiencia && (
            <Section title="Experiencia">
              {expLine && <p className="text-[18px] leading-[1.5] text-[#e5e2e1]">{expLine}</p>}
              <InfoRow label="Detalle" value={p.experiencia_detalle} />
            </Section>
          )}

          {hasDisponibilidad && (
            <Section title="Disponibilidad">
              {dispPills.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {dispPills.map((label) => (
                    <span
                      key={label}
                      className="label-tech text-[11px] border border-[#4c4546] text-[#e5e2e1] px-3 py-2"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              )}
              <InfoRow label="Aviso de disponibilidad" value={p.disponibilidad_aviso} />
            </Section>
          )}

          {hasSituacion && (
            <Section title="Situación">
              <InfoRow label="Situación legal" value={p.situacion_legal} />
              <InfoRow label="Dónde puede trabajar" value={dondeTrabajar} />
              <InfoRow label="País de residencia" value={p.pais_residencia} />
            </Section>
          )}

          {cv.kind !== "none" && (
            <Section title="CV">
              <CvView classification={cv} />
            </Section>
          )}

          {hasLinks && (
            <Section title="Links">
              <ExternalRow label="Portfolio" value={p.portfolio_url} />
              <ExternalRow label="LinkedIn" value={p.linkedin_url} />
            </Section>
          )}

          {offers.length > 0 && (
            <Section title="Ofertas">
              <OfferStatusList offers={offers} />
            </Section>
          )}

          {ratableGigs.length > 0 && (
            <Section title="Calificación">
              <Rating staffProfileId={id} gigs={ratableGigs} />
            </Section>
          )}
        </div>

        {/* Derecha */}
        <div className="md:col-span-5 flex flex-col gap-10">
          {/* Métricas */}
          <section className="flex flex-col gap-4">
            <h2 className="label-tech text-[12px] text-[#cfc4c5]">Métricas</h2>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-6 flex flex-col gap-1">
                <span className="font-[family-name:var(--font-syne)] text-[40px] font-bold leading-none text-[#e5e2e1]">
                  {eventosCount}
                </span>
                <span className="label-tech text-[11px] text-[#cfc4c5]">
                  {eventosCount === 1 ? "Evento" : "Eventos"}
                </span>
              </div>
              <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-6 flex flex-col gap-1">
                <span className="font-[family-name:var(--font-syne)] text-[40px] font-bold leading-none text-[#e5e2e1]">
                  {avgRating ? avgRating.toFixed(1) : "—"}
                </span>
                <span className="label-tech text-[11px] text-[#cfc4c5]">Rating</span>
              </div>
            </div>
          </section>

          {/* Oficios / skills */}
          {oficios.length > 0 && (
            <section className="flex flex-col gap-4 border-t border-[#1A1A1A] pt-6">
              <h2 className="label-tech text-[12px] text-[#cfc4c5]">Oficios</h2>
              <div className="flex flex-wrap gap-2">
                {oficios.map((oficio) => (
                  <span
                    key={oficio}
                    className="label-tech text-[11px] border border-[#4c4546] text-[#e5e2e1] px-3 py-2"
                  >
                    {oficio}
                  </span>
                ))}
              </div>
              <InfoRow label="Otro oficio" value={p.oficios_otro} />
            </section>
          )}

          {/* Favorito y nota privada */}
          <section className="flex flex-col gap-4 border-t border-[#1A1A1A] pt-6">
            <h2 className="label-tech text-[12px] text-[#cfc4c5]">Favorito y nota</h2>
            <FavoriteNote
              staffProfileId={id}
              initialFavorite={candidateNote?.is_favorite ?? false}
              initialNote={candidateNote?.note ?? null}
            />
          </section>
        </div>
      </div>

      {/* Acciones rápidas (sticky, sólo si hay teléfono) */}
      {(p.telefono ?? "").trim() && (
        <QuickActions telefono={p.telefono!.trim()} nombre={p.nombre} />
      )}
    </div>
  );
}
