/**
 * LA FICHA PÚBLICA DE UN SALÓN: /salones/[slug].
 *
 * Es la página que se comparte. Por eso la consulta vive acá y no en un diálogo:
 * un diálogo no se puede pegar en un WhatsApp ni lo indexa nadie, y este link es
 * todo el marketing que un salón chico va a tener.
 *
 * ── EL 404 ES DE VERDAD ─────────────────────────────────────────────────────
 * Si el salón se despublicó, esta página deja de existir. No se muestra un
 * perfil apagado con el botón gris: alguien que llega desde un link viejo tiene
 * que poder volver al directorio, no quedarse mirando una lápida.
 *
 * ── LA DIRECCIÓN SÍ SE MUESTRA, EL MAIL NO ──────────────────────────────────
 * Un salón sin dirección no se puede evaluar: la mitad de la decisión es a qué
 * distancia queda de donde vive la gente que va a ir. Por eso `direccion` viaja
 * en la ficha, a diferencia del proveedor. El mail y el teléfono siguen sin
 * viajar, igual que en /servicios: si la consulta va por el formulario, entregar
 * la dirección de mail deja abierta la puerta de atrás y nos deja sin registro.
 */

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, MapPin, Users, Maximize2, ArrowLeft } from "lucide-react";
import { LaburoWordmark } from "@/components/laburo-wordmark";
import { ConsultaPublicaForm } from "@/components/vidriera/consulta-publica-form";
import { textoCapacidad, urlDeFotoSalon } from "@/lib/salones";
import { getFichaSalon } from "../actions";

const WRAP = "max-w-[1440px] mx-auto w-full px-6 md:px-20";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const s = await getFichaSalon(slug);
  if (!s) return { title: "Salón no encontrado | LABURO" };

  const capacidad = textoCapacidad(s.capacidad_min, s.capacidad_max);
  const donde = [s.ciudad, s.provincia].filter(Boolean).join(", ");
  const descripcion =
    s.headline?.trim() ||
    [capacidad, donde].filter(Boolean).join(" · ") ||
    "Consultá la fecha para tu evento.";

  return {
    title: `${s.display_name} | Salones LABURO`,
    description: descripcion,
    alternates: { canonical: `/salones/${s.slug}` },
    openGraph: {
      type: "profile",
      url: `/salones/${s.slug}`,
      siteName: "LABURO",
      locale: "es_AR",
      title: `${s.display_name} | Salones LABURO`,
      description: descripcion,
      images: [{ url: "/brand/laburo-og.png", width: 1200, height: 630, alt: "LABURO" }],
    },
  };
}

/** Un dato del cuadro de arriba. Solo se dibuja si el salón lo cargó. */
function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label-tech text-[10px] uppercase tracking-[0.2em] text-[#8a8a8a]">
        {label}
      </span>
      <span className="text-[16px] text-[#f5f5f5]">{valor}</span>
    </div>
  );
}

export default async function FichaSalonPage({ params }: Props) {
  const { slug } = await params;
  const s = await getFichaSalon(slug);
  if (!s) notFound();

  const ubicacion = [s.ciudad, s.provincia].filter(Boolean).join(", ");
  const capacidad = textoCapacidad(s.capacidad_min, s.capacidad_max);

  // Tres estados y no dos: sí, no, y "no lo dijo". El tercero NO se muestra.
  // Escribir "Catering: no" cuando el salón nunca contestó sería inventarle una
  // respuesta, y encima la que le hace perder la consulta.
  const datos = [
    s.superficie_m2 ? { label: "Superficie", valor: `${s.superficie_m2} m²` } : null,
    s.catering_propio === true
      ? { label: "Catering", valor: "Podés traer el tuyo" }
      : s.catering_propio === false
        ? { label: "Catering", valor: "Lo pone la casa" }
        : null,
    s.estacionamiento === true
      ? { label: "Estacionamiento", valor: "Sí" }
      : s.estacionamiento === false
        ? { label: "Estacionamiento", valor: "No tiene" }
        : null,
  ].filter(Boolean) as { label: string; valor: string }[];

  return (
    <div className="min-h-dvh bg-black text-[#f5f5f5] selection:bg-[#0047ff] selection:text-white">
      <header className="border-b border-[#1a1a1a]">
        <div className={`${WRAP} py-6 flex items-center justify-between gap-4`}>
          <Link href="/" aria-label="LABURO, ir al inicio">
            <LaburoWordmark className="h-[18px] md:h-[24px] w-auto" priority />
          </Link>
          <Link
            href="/salones"
            className="inline-flex items-center gap-2 label-tech text-[10px] md:text-[11px] tracking-[0.2em] text-white/70 hover:text-[#0047ff] transition-colors duration-300"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Ver todos
          </Link>
        </div>
      </header>

      <main className={`${WRAP} py-14 md:py-20`}>
        {/* LAS FOTOS VAN ARRIBA DE TODO, antes del nombre. Un salón se elige
         * mirando: la foto es lo que decide si la persona sigue leyendo. La
         * primera va grande y el resto en una tira abajo.
         *
         * Sin fotos NO se dibuja nada: un placeholder gris ocupando media
         * pantalla arriba de todo hace que el salón se vea peor que sin foto. */}
        {s.fotos?.length ? (
          <div className="flex flex-col gap-3 mb-12 md:mb-16">
            <div className="w-full aspect-[16/9] md:aspect-[21/9] overflow-hidden border border-[#1a1a1a]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={urlDeFotoSalon(s.fotos[0])}
                alt={s.display_name ?? "Salón"}
                className="w-full h-full object-cover"
              />
            </div>
            {s.fotos.length > 1 ? (
              /* Tira que scrollea SOLA: con ocho fotos, en un teléfono, una
               * grilla las dejaría del tamaño de una estampilla. */
              <div className="flex gap-3 overflow-x-auto pb-1">
                {s.fotos.slice(1).map((f, i) => (
                  <div
                    key={f}
                    className="shrink-0 w-[180px] md:w-[240px] aspect-[4/3] overflow-hidden border border-[#1a1a1a]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={urlDeFotoSalon(f)}
                      alt={`${s.display_name ?? "Salón"}, foto ${i + 2}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          {/* ── Qué salón es ── */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              {s.is_verified ? (
                <span className="inline-flex items-center gap-1.5 label-tech text-[10px] uppercase tracking-[0.2em] text-[#0047ff]">
                  <BadgeCheck size={14} aria-hidden="true" />
                  verificado por SOMOS DER
                </span>
              ) : null}
              <h1 className="font-[family-name:var(--font-syne)] font-extrabold uppercase tracking-tighter leading-[0.92] text-[clamp(32px,5vw,64px)] [overflow-wrap:anywhere]">
                {s.display_name}
              </h1>
              {s.headline?.trim() ? (
                <p className="text-[18px] md:text-[20px] leading-[1.6] text-[#cfc4c5]">
                  {s.headline}
                </p>
              ) : null}

              {/* La capacidad, grande y arriba: es lo que la persona vino a saber. */}
              {capacidad ? (
                <span className="inline-flex items-center gap-2.5 text-[19px] md:text-[21px] text-[#f5f5f5]">
                  <Users size={20} aria-hidden="true" className="text-[#0047ff]" />
                  {capacidad}
                </span>
              ) : null}

              <div className="flex flex-col gap-2">
                {ubicacion ? (
                  <span className="inline-flex items-center gap-2 text-[15px] text-[#8a8a8a]">
                    <MapPin size={15} aria-hidden="true" />
                    {s.direccion?.trim() ? `${s.direccion}, ${ubicacion}` : ubicacion}
                  </span>
                ) : null}
                {s.superficie_m2 ? (
                  <span className="inline-flex items-center gap-2 text-[15px] text-[#8a8a8a]">
                    <Maximize2 size={14} aria-hidden="true" />
                    {s.superficie_m2} m²
                  </span>
                ) : null}
              </div>
            </div>

            {s.bio?.trim() ? (
              <p className="text-[16px] md:text-[17px] leading-[1.75] text-[#8a8a8a] whitespace-pre-wrap border-t border-[#1a1a1a] pt-6">
                {s.bio}
              </p>
            ) : null}

            {datos.length ? (
              <div className="border-t border-[#1a1a1a] pt-8 grid grid-cols-2 sm:grid-cols-3 gap-6">
                {datos.map((d) => (
                  <Dato key={d.label} label={d.label} valor={d.valor} />
                ))}
              </div>
            ) : null}

            {s.tipos_evento?.length ? (
              <div className="border-t border-[#1a1a1a] pt-8 flex flex-col gap-4">
                <span className="label-tech text-[11px] tracking-[0.25em] text-[#8a8a8a]">
                  Para qué se alquila
                </span>
                <div className="flex flex-wrap gap-2">
                  {s.tipos_evento.map((t) => (
                    <span
                      key={t}
                      className="label-tech text-[10px] uppercase tracking-[0.18em] text-[#cfc4c5] border border-[#1a1a1a] px-3 py-1.5"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {s.amenities?.length ? (
              <div className="border-t border-[#1a1a1a] pt-8 flex flex-col gap-4">
                <span className="label-tech text-[11px] tracking-[0.25em] text-[#8a8a8a]">
                  Qué tiene
                </span>
                <div className="flex flex-wrap gap-2">
                  {s.amenities.map((a) => (
                    <span
                      key={a}
                      className="text-[15px] text-[#cfc4c5] border-l-2 border-[#1a1a1a] pl-3 pr-4"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Lo mismo que se le dice al que mira precios de un proveedor: acá
             *  no hay precio publicado, y hay que decirlo antes de que lo busque
             *  y no lo encuentre. */}
            <p className="text-[13px] leading-[1.6] text-[#8a8a8a] border-t border-[#1a1a1a] pt-6">
              El precio y la disponibilidad te los pasa el salón, por mail,
              después de leer tu consulta. Depende de la fecha y de cuántos sean.
            </p>

            {s.website?.trim() || s.instagram?.trim() ? (
              <div className="border-t border-[#1a1a1a] pt-6 flex flex-wrap gap-x-8 gap-y-3">
                {s.website?.trim() ? (
                  <a
                    href={s.website}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="label-tech text-[11px] uppercase tracking-[0.2em] text-[#8a8a8a] hover:text-[#0047ff] transition-colors"
                  >
                    Su web
                  </a>
                ) : null}
                {s.instagram?.trim() ? (
                  <a
                    href={
                      s.instagram.startsWith("http")
                        ? s.instagram
                        : `https://instagram.com/${s.instagram.replace(/^@/, "")}`
                    }
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="label-tech text-[11px] uppercase tracking-[0.2em] text-[#8a8a8a] hover:text-[#0047ff] transition-colors"
                  >
                    Instagram
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* ── La consulta ── */}
          <div className="lg:col-span-6 lg:col-start-8">
            <div className="border border-[#1a1a1a] bg-[#050505] p-6 md:p-10">
              <ConsultaPublicaForm
                profileId={s.profile_id}
                nombreProveedor={s.display_name ?? "este salón"}
                campos={s.campos}
                intro={s.intro}
                volverHref="/salones"
                volverTexto="Consultar en otro también"
                titulo="Consultá tu fecha"
              />
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-[#1a1a1a]">
        <div className={`${WRAP} py-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6`}>
          <span className="label-tech text-[10px] tracking-[0.25em] text-[#8a8a8a]">
            © 2026 LABURO · SOMOS DER
          </span>
          <Link
            href="/salones"
            className="label-tech text-[11px] tracking-[0.25em] text-[#8a8a8a] hover:text-[#0047ff] transition-colors"
          >
            Ver todos los salones
          </Link>
        </div>
      </footer>
    </div>
  );
}
