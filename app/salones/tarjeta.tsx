/**
 * Una fila del directorio de salones.
 *
 * Server component a propósito: no tiene ni un estado. La consulta vive en su
 * propia página (/salones/[slug]) porque esa página ES la dirección que se
 * comparte. Un diálogo no se puede pegar en un WhatsApp.
 *
 * ── QUÉ SE MUESTRA Y POR QUÉ ESE ORDEN ──────────────────────────────────────
 * Primero el nombre, después LA CAPACIDAD y recién ahí dónde queda. En la fila
 * de un proveedor lo segundo es el rubro; acá lo segundo es cuánta gente entra,
 * porque es el dato que decide si la persona sigue leyendo o pasa al siguiente.
 */

import Link from "next/link";
import { BadgeCheck, MapPin, Users, Maximize2 } from "lucide-react";
import { textoCapacidad } from "@/lib/salones";
import type { SalonPublico } from "./actions";

export function TarjetaSalon({ s }: { s: SalonPublico }) {
  const ubicacion = [s.ciudad, s.provincia].filter(Boolean).join(", ");
  const capacidad = textoCapacidad(s.capacidad_min, s.capacidad_max);

  // Las tres cosas que más se preguntan de un salón, en una línea. Se arma acá
  // y no en la base porque son etiquetas, no datos: `catering_propio` es un
  // boolean de tres estados (sí, no, no lo dijo) y "no lo dijo" no se muestra,
  // porque una etiqueta ausente es honesta y una que diga "no" sería inventar.
  const extras = [
    s.catering_propio === true ? "Podés traer tu catering" : null,
    s.catering_propio === false ? "Catering de la casa" : null,
    s.estacionamiento === true ? "Estacionamiento" : null,
  ].filter(Boolean) as string[];

  return (
    <article className="flex flex-col md:flex-row md:items-start justify-between gap-6 py-8 border-b border-[#1a1a1a]">
      <div className="min-w-0 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* `overflow-wrap:anywhere` no es decorativo: el nombre lo escribe el
           *  salón y puede ser una sola palabra larguísima. */}
          <h2 className="font-[family-name:var(--font-syne)] text-[24px] md:text-[28px] font-bold uppercase tracking-tight text-[#f5f5f5] [overflow-wrap:anywhere]">
            {s.display_name ?? "Sin nombre"}
          </h2>
          {s.is_verified ? (
            <span className="inline-flex items-center gap-1.5 label-tech text-[10px] uppercase tracking-[0.2em] text-[#0047ff]">
              <BadgeCheck size={14} aria-hidden="true" />
              verificado por SOMOS DER
            </span>
          ) : null}
        </div>

        {/* La capacidad va acá arriba, antes que nada: es por lo que se busca. */}
        {capacidad ? (
          <span className="inline-flex items-center gap-2 text-[16px] text-[#cfc4c5]">
            <Users size={15} aria-hidden="true" />
            {capacidad}
          </span>
        ) : null}

        {s.headline?.trim() ? (
          <p className="text-[16px] text-[#cfc4c5] max-w-[620px]">{s.headline}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {ubicacion ? (
            <span className="inline-flex items-center gap-2 text-[15px] text-[#8a8a8a]">
              <MapPin size={14} aria-hidden="true" />
              {ubicacion}
            </span>
          ) : null}
          {s.superficie_m2 ? (
            <span className="inline-flex items-center gap-2 text-[15px] text-[#8a8a8a]">
              <Maximize2 size={14} aria-hidden="true" />
              {s.superficie_m2} m²
            </span>
          ) : null}
        </div>

        {s.tipos_evento?.length ? (
          <div className="flex flex-wrap gap-2 mt-1">
            {s.tipos_evento.slice(0, 6).map((t) => (
              <span
                key={t}
                className="label-tech text-[10px] uppercase tracking-[0.18em] text-[#8a8a8a] border border-[#1a1a1a] px-3 py-1.5"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}

        {extras.length ? (
          <p className="text-[14px] text-[#8a8a8a] mt-1">{extras.join(" · ")}</p>
        ) : null}
      </div>

      <div className="shrink-0">
        <Link
          href={`/salones/${s.slug}`}
          className="inline-flex items-center justify-center bg-[#f5f5f5] text-black px-8 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:bg-[#0047ff] hover:text-white transition-colors duration-300"
        >
          Consultar fecha
        </Link>
      </div>
    </article>
  );
}
