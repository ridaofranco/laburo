/**
 * /proveedores — la productora encuentra proveedores (Fase 3).
 *
 * Cierra el triángulo: la productora ya podía encontrar personal (buscando o
 * recibiendo postulaciones) y ahora también servicios. Es lo que Franco pidió el
 * 2/8: "si a la productora le faltan proveedores, que puedan tenerlos".
 *
 * La búsqueda cruza organizaciones: un proveedor publicado lo ve cualquier
 * productora. Lo privado de cada una (nota, favorito) no cruza.
 */

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { buscarProveedores, getCategorias } from "./actions";
import { ProveedoresClient } from "./proveedores-client";

export const metadata: Metadata = {
  title: "LABURO. | Proveedores",
};

export default async function ProveedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string; prov?: string }>;
}) {
  const sp = await searchParams;
  const filtros = {
    texto: sp.q ?? "",
    categoria: sp.cat ?? "",
    provincia: sp.prov ?? "",
  };

  const [proveedores, categorias] = await Promise.all([
    buscarProveedores(filtros),
    getCategorias(),
  ]);

  return (
    <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-10 md:py-16 flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <p className="label-tech text-[12px] uppercase tracking-[0.2em] text-[#c6c6c6]">
          Proveedores
        </p>
        <h1 className="t-display text-[#e5e2e1]">
          {proveedores.length === 0
            ? "Buscar proveedores"
            : proveedores.length === 1
              ? "1 proveedor"
              : `${proveedores.length} proveedores`}
        </h1>
        <p className="text-[16px] text-[#cfc4c5] leading-[1.6] max-w-[640px] mt-1">
          Sonido, catering, fotos, seguridad, lo que te falte para el evento.
          Escribiles directo por WhatsApp o por mail.
        </p>
      </header>

      <ProveedoresClient
        proveedores={proveedores}
        categorias={categorias}
        filtros={filtros}
      />
    </div>
  );
}
