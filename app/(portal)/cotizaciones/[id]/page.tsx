/**
 * /cotizaciones/[id] — el pedido: a quién se le pidió, qué contestaron y elegir.
 *
 * Es la etapa 2 (invitar) y la 4 (comparar y adjudicar) en una sola pantalla, y
 * eso es a propósito: son el mismo objeto en dos momentos, y partirlo en dos
 * rutas obligaría a la productora a acordarse de volver.
 */

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPedido, getCotizaciones } from "../actions";
import { PedidoClient } from "./pedido-client";

export const metadata: Metadata = {
  title: "LABURO. | Pedido de precio",
};

export default async function PedidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pedido = await getPedido(id);
  if (!pedido) notFound();

  const { cotizaciones, sinCotizar } = await getCotizaciones(id);

  return (
    <div className="max-w-[1100px] mx-auto px-6 md:px-10 py-10 md:py-16 flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link href="/cotizaciones" className="text-[14px] text-[#8A8A8A] hover:text-[#e5e2e1]">
          ← Pedidos de precio
        </Link>
        <h1 className="t-display text-[#e5e2e1]">{pedido.titulo}</h1>
      </header>

      <PedidoClient pedido={pedido} cotizaciones={cotizaciones} sinCotizar={sinCotizar} />
    </div>
  );
}
