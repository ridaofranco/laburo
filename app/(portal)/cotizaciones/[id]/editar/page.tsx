/**
 * /cotizaciones/[id]/editar — corregir un pedido sin rehacerlo.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 * De un pedido solo se podía correr la fecha, cerrarlo o cancelarlo. Un título
 * mal escrito o una pregunta de más obligaban a rehacerlo entero, y rehacerlo
 * PIERDE LAS INVITACIONES, que son lo caro: cada una es un mail que ya salió y
 * un token que alguien puede tener abierto en el celular.
 *
 * ── POR QUÉ ES EL MISMO FORMULARIO Y NO UNO PARECIDO ────────────────────────
 * `NuevoPedidoForm` en modo edición. Son los mismos campos con los mismos
 * textos, y este repo ya pagó dos veces el precio de copiar en vez de compartir
 * (el botón de Google, el `signInWithPassword`). Un formulario propio acá es la
 * garantía de que dentro de tres meses uno pida algo que el otro no.
 *
 * ── LOS DOS CANDADOS ────────────────────────────────────────────────────────
 * · Solo un pedido ABIERTO se edita. Uno adjudicado o cancelado ya le mandó a
 *   los que cotizaron un mail diciendo cómo terminó.
 * · Los ítems se editan solo si todavía no cotizó nadie. Cambiarlos con
 *   presupuestos adentro borraría en cascada las líneas de cada proveedor y el
 *   total de cada cotización quedaría siendo la suma de algo que ya no existe.
 *   La base lo corta igual (`ya_cotizaron`); acá directamente no se ofrece.
 */

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPedido, getCotizaciones } from "../../actions";
import { NuevoPedidoForm } from "../../nuevo/nuevo-client";
import { CATEGORIAS_PROVEEDOR } from "@/lib/categorias-proveedor";
import { PROVINCIAS } from "@/lib/provincias";

export const metadata: Metadata = {
  title: "LABURO. | Corregir el pedido",
};

export default async function EditarPedidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pedido = await getPedido(id);
  if (!pedido) notFound();

  // Cerrado, adjudicado o cancelado: se vuelve al pedido en vez de mostrar un
  // formulario que la base va a rechazar. Un error después de escribir es peor
  // que no dejar escribir.
  if (pedido.estado !== "abierta") redirect(`/cotizaciones/${id}`);

  const { cotizaciones } = await getCotizaciones(id);

  return (
    <div className="max-w-[760px] mx-auto px-6 md:px-10 py-10 md:py-16 flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link href={`/cotizaciones/${id}`} className="text-[14px] text-[#8A8A8A] hover:text-[#e5e2e1]">
          ← {pedido.titulo}
        </Link>
        <h1 className="t-display text-[#e5e2e1]">Corregir el pedido</h1>
        <p className="text-[16px] text-[#cfc4c5] leading-[1.6]">
          Las invitaciones que ya mandaste quedan como están, y los links que
          entregaste siguen andando: el que lo abra va a ver el pedido corregido.
        </p>
      </header>

      <NuevoPedidoForm
        categorias={CATEGORIAS_PROVEEDOR}
        provincias={PROVINCIAS}
        pedido={pedido}
        itemsBloqueados={cotizaciones.length > 0}
      />
    </div>
  );
}
