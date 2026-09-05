/**
 * /cotizaciones/nuevo — armar el pedido (etapa 2 de LICITACIONES.md).
 *
 * Server component fino: el formulario es cliente porque el desglose se edita
 * en vivo (se agregan y se borran preguntas según el rubro).
 */

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { NuevoPedidoForm } from "./nuevo-client";
import { CATEGORIAS_PROVEEDOR } from "@/lib/categorias-proveedor";
import { PROVINCIAS } from "@/lib/provincias";

export const metadata: Metadata = {
  title: "LABURO. | Nuevo pedido de precio",
};

export default function NuevoPedidoPage() {
  return (
    <div className="max-w-[760px] mx-auto px-6 md:px-10 py-10 md:py-16 flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link href="/cotizaciones" className="text-[14px] text-[#8A8A8A] hover:text-[#e5e2e1]">
          ← Pedidos de precio
        </Link>
        <h1 className="t-display text-[#e5e2e1]">Nuevo pedido</h1>
        <p className="text-[16px] text-[#cfc4c5] leading-[1.6]">
          Primero armás qué necesitás y qué querés que te detallen. Después elegís a
          quién mandárselo.
        </p>
      </header>

      <NuevoPedidoForm categorias={CATEGORIAS_PROVEEDOR} provincias={PROVINCIAS} />
    </div>
  );
}
