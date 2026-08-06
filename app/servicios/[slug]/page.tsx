/**
 * LA FICHA PÚBLICA DE UN PROVEEDOR: /servicios/[slug] (Fase 4).
 *
 * Es la página que se comparte. Por eso la consulta vive acá y no en un diálogo
 * como en /proveedores: un diálogo no se puede pegar en un WhatsApp ni lo indexa
 * nadie, y este link es todo el marketing que un proveedor chico va a tener.
 *
 * ── POR QUÉ EL FORMULARIO ESTÁ ABIERTO Y NO DETRÁS DE UN BOTÓN ──
 * Porque cada tap es gente que se va. La persona ya hizo dos clicks para llegar
 * hasta acá (buscar, entrar); pedirle un tercero para recién ver las preguntas
 * es regalar la consulta. El formulario se sirve renderizado con la página.
 *
 * ── EL 404 ES DE VERDAD ──
 * Si el proveedor se despublicó, esta página deja de existir. No se muestra un
 * perfil apagado con el botón gris: alguien que llega desde un link viejo tiene
 * que poder volver al directorio, no quedarse mirando una lápida.
 */

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, MapPin, ArrowLeft } from "lucide-react";
import { LaburoWordmark } from "@/components/laburo-wordmark";
import { money } from "@/lib/format";
import { getFichaProveedor } from "../actions";
// El formulario se mudó a components/vidriera cuando entró el pool de salones:
// es el mismo para las dos vidrieras. Acá no cambió nada de lo que muestra.
import { ConsultaPublicaForm } from "@/components/vidriera/consulta-publica-form";

const WRAP = "max-w-[1440px] mx-auto w-full px-6 md:px-20";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getFichaProveedor(slug);
  if (!p) return { title: "Proveedor no encontrado | LABURO" };

  const rubros = Array.from(new Set(p.servicios.map((s) => s.categoria))).join(", ");
  const descripcion =
    p.headline?.trim() ||
    (rubros ? `${rubros} para tu evento.` : "Pedile presupuesto para tu evento.");

  return {
    title: `${p.display_name} | Proveedores LABURO`,
    description: descripcion,
    alternates: { canonical: `/servicios/${p.slug}` },
    openGraph: {
      type: "profile",
      url: `/servicios/${p.slug}`,
      siteName: "LABURO",
      locale: "es_AR",
      title: `${p.display_name} | Proveedores LABURO`,
      description: descripcion,
      images: [{ url: "/brand/laburo-og.png", width: 1200, height: 630, alt: "LABURO" }],
    },
  };
}

export default async function FichaProveedorPage({ params }: Props) {
  const { slug } = await params;
  const p = await getFichaProveedor(slug);
  if (!p) notFound();

  const ubicacion = [p.ciudad, p.provincia].filter(Boolean).join(", ");

  return (
    <div className="min-h-dvh bg-black text-[#f5f5f5] selection:bg-[#0047ff] selection:text-white">
      <header className="border-b border-[#1a1a1a]">
        <div className={`${WRAP} py-6 flex items-center justify-between gap-4`}>
          <Link href="/" aria-label="LABURO, ir al inicio">
            <LaburoWordmark className="h-[18px] md:h-[24px] w-auto" priority />
          </Link>
          <Link
            href="/servicios"
            className="inline-flex items-center gap-2 label-tech text-[10px] md:text-[11px] tracking-[0.2em] text-white/70 hover:text-[#0047ff] transition-colors duration-300"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Ver todos
          </Link>
        </div>
      </header>

      <main className={`${WRAP} py-14 md:py-20`}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          {/* ── Quién es ── */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              {p.is_verified ? (
                <span className="inline-flex items-center gap-1.5 label-tech text-[10px] uppercase tracking-[0.2em] text-[#0047ff]">
                  <BadgeCheck size={14} aria-hidden="true" />
                  verificado por SOMOS DER
                </span>
              ) : null}
              {/* `overflow-wrap:anywhere` no es decorativo: el nombre lo escribe
               *  el proveedor y puede ser una sola palabra larguísima. Sin esto,
               *  "Catering Verificación" ya se salía de la columna y quedaba
               *  cortado contra el borde del formulario (visto al probarlo). */}
              <h1 className="font-[family-name:var(--font-syne)] font-extrabold uppercase tracking-tighter leading-[0.92] text-[clamp(32px,5vw,64px)] [overflow-wrap:anywhere]">
                {p.display_name}
              </h1>
              {p.headline?.trim() ? (
                <p className="text-[18px] md:text-[20px] leading-[1.6] text-[#cfc4c5]">
                  {p.headline}
                </p>
              ) : null}
              {ubicacion ? (
                <span className="inline-flex items-center gap-2 text-[15px] text-[#8a8a8a]">
                  <MapPin size={15} aria-hidden="true" />
                  {ubicacion}
                </span>
              ) : null}
            </div>

            {p.bio?.trim() ? (
              <p className="text-[16px] md:text-[17px] leading-[1.75] text-[#8a8a8a] whitespace-pre-wrap border-t border-[#1a1a1a] pt-6">
                {p.bio}
              </p>
            ) : null}

            {p.servicios.length ? (
              <div className="border-t border-[#1a1a1a] pt-8 flex flex-col gap-6">
                <span className="label-tech text-[11px] tracking-[0.25em] text-[#8a8a8a]">
                  Qué ofrece
                </span>
                {p.servicios.map((s, i) => (
                  <div key={i} className="border-l-2 border-[#1a1a1a] pl-5 flex flex-col gap-1.5">
                    <span className="label-tech text-[10px] uppercase tracking-[0.18em] text-[#0047ff]">
                      {s.categoria}
                    </span>
                    <p className="text-[18px] text-[#f5f5f5]">{s.titulo}</p>
                    {s.descripcion?.trim() ? (
                      <p className="text-[15px] leading-[1.65] text-[#8a8a8a] max-w-[520px]">
                        {s.descripcion}
                      </p>
                    ) : null}
                    <span className="text-[15px] text-[#cfc4c5]">
                      {s.precio_desde != null && Number(s.precio_desde) > 0
                        ? `Desde ${money(Number(s.precio_desde))}${s.unidad ? ` / ${s.unidad}` : ""}`
                        : "Precio a consultar"}
                      {s.provincias?.length ? ` · ${s.provincias.join(", ")}` : ""}
                    </span>
                  </div>
                ))}
                {/* Los precios son de referencia y hay que decirlo. Alguien que
                 *  planifica su fiesta con estos números y después recibe otro
                 *  presupuesto siente que le mintieron, y el que queda mal es el
                 *  proveedor. */}
                <p className="text-[13px] leading-[1.6] text-[#8a8a8a]">
                  Los precios son orientativos y los carga cada proveedor. El
                  presupuesto real te lo pasa él, por mail, después de leer tu
                  consulta.
                </p>
              </div>
            ) : null}

            {p.website?.trim() || p.instagram?.trim() ? (
              <div className="border-t border-[#1a1a1a] pt-6 flex flex-wrap gap-x-8 gap-y-3">
                {p.website?.trim() ? (
                  <a
                    href={p.website}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="label-tech text-[11px] uppercase tracking-[0.2em] text-[#8a8a8a] hover:text-[#0047ff] transition-colors"
                  >
                    Su web
                  </a>
                ) : null}
                {p.instagram?.trim() ? (
                  <a
                    href={
                      p.instagram.startsWith("http")
                        ? p.instagram
                        : `https://instagram.com/${p.instagram.replace(/^@/, "")}`
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
                profileId={p.profile_id}
                nombreProveedor={p.display_name ?? "este proveedor"}
                campos={p.campos}
                intro={p.intro}
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
            href="/servicios"
            className="label-tech text-[11px] tracking-[0.25em] text-[#8a8a8a] hover:text-[#0047ff] transition-colors"
          >
            Ver todos los proveedores
          </Link>
        </div>
      </footer>
    </div>
  );
}
