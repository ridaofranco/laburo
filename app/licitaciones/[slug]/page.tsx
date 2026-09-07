/**
 * /licitaciones/[slug] — la página pública de un pedido de precio.
 *
 * "FIEBRE DISCO está cotizando lo siguiente", que es como lo pidió Franco. O
 * "Una productora está cotizando lo siguiente", si eligió no mostrar el nombre.
 *
 * ⚠️ NO MUESTRA NADA DE LOS QUE YA COTIZARON. Ni cuántos son, ni quiénes, ni por
 * cuánto. Es una licitación: si el que entra ve que hay una sola cotización o
 * que hay doce, cotiza distinto, y el precio deja de ser el suyo.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LicitacionClient } from "./licitacion-client";

async function traer(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("staff_app_licitacion", { p_slug: slug });
  const l = data as Record<string, unknown> | null;
  return l?.ok ? l : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const l = await traer(slug);
  if (!l) return { title: "LABURO. | Licitación" };
  return {
    title: `${l.quien} pide presupuesto: ${l.titulo} | LABURO`,
    description:
      (l.descripcion as string | null)?.slice(0, 160) ??
      `Presupuestá este pedido en LABURO. Cierra el ${l.cierra_at}.`,
  };
}

export default async function LicitacionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const l = await traer(slug);
  if (!l) notFound();
  return <LicitacionClient slug={slug} lic={l} />;
}
