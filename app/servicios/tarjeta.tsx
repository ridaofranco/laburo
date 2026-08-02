/**
 * Una fila del directorio público.
 *
 * Server component a propósito: no tiene ni un estado. En /proveedores la
 * tarjeta abre el diálogo de consulta ahí mismo, pero acá la consulta vive en su
 * propia página (/servicios/[slug]) porque esa página ES la dirección que se
 * comparte. Un diálogo no se puede pegar en un WhatsApp.
 */

import Link from "next/link";
import { BadgeCheck, MapPin } from "lucide-react";
import { money } from "@/lib/format";
import type { ProveedorPublico } from "./actions";

export function TarjetaProveedor({ p }: { p: ProveedorPublico }) {
  const ubicacion = [p.ciudad, p.provincia].filter(Boolean).join(", ");
  // Los rubros se muestran una sola vez cada uno: un proveedor con seis
  // servicios de catering no tiene que llenar la fila con la misma palabra.
  const rubros = Array.from(new Set(p.servicios.map((s) => s.categoria)));

  return (
    <article className="flex flex-col md:flex-row md:items-start justify-between gap-6 py-8 border-b border-[#1a1a1a]">
      <div className="min-w-0 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-[family-name:var(--font-syne)] text-[24px] md:text-[28px] font-bold uppercase tracking-tight text-[#f5f5f5] [overflow-wrap:anywhere]">
            {p.display_name ?? "Sin nombre"}
          </h2>
          {p.is_verified ? (
            <span className="inline-flex items-center gap-1.5 label-tech text-[10px] uppercase tracking-[0.2em] text-[#0047ff]">
              <BadgeCheck size={14} aria-hidden="true" />
              verificado por SOMOS DER
            </span>
          ) : null}
        </div>

        {p.headline?.trim() ? (
          <p className="text-[16px] text-[#cfc4c5] max-w-[620px]">{p.headline}</p>
        ) : null}

        {ubicacion ? (
          <span className="inline-flex items-center gap-2 text-[15px] text-[#8a8a8a]">
            <MapPin size={14} aria-hidden="true" />
            {ubicacion}
          </span>
        ) : null}

        {rubros.length ? (
          <div className="flex flex-wrap gap-2 mt-1">
            {rubros.map((r) => (
              <span
                key={r}
                className="label-tech text-[10px] uppercase tracking-[0.18em] text-[#8a8a8a] border border-[#1a1a1a] px-3 py-1.5"
              >
                {r}
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 mt-2">
          {p.servicios.slice(0, 3).map((s, i) => (
            <div key={i} className="border-l-2 border-[#1a1a1a] pl-4">
              <p className="text-[16px] text-[#f5f5f5]">{s.titulo}</p>
              <span className="text-[14px] text-[#8a8a8a]">
                {s.precio_desde != null && Number(s.precio_desde) > 0
                  ? `Desde ${money(Number(s.precio_desde))}${s.unidad ? ` / ${s.unidad}` : ""}`
                  : "Precio a consultar"}
              </span>
            </div>
          ))}
          {p.servicios.length > 3 ? (
            <span className="text-[14px] text-[#8a8a8a] pl-4">
              y {p.servicios.length - 3} servicio
              {p.servicios.length - 3 === 1 ? "" : "s"} más
            </span>
          ) : null}
        </div>
      </div>

      <div className="shrink-0">
        <Link
          href={`/servicios/${p.slug}`}
          className="inline-flex items-center justify-center bg-[#f5f5f5] text-black px-8 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:bg-[#0047ff] hover:text-white transition-colors duration-300"
        >
          Pedir presupuesto
        </Link>
      </div>
    </article>
  );
}
