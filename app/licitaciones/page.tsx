/**
 * /licitaciones — todas las licitaciones abiertas, para cualquiera.
 *
 * Es la otra mitad de lo que pidió Franco el 7/9: la página de UN pedido sirve
 * para el que ya tiene el link, pero sin un índice nadie llega solo. Acá es
 * donde un proveedor que no conoce LABURO encuentra que hay trabajo.
 *
 * ⚠️ Solo lista las que están ABIERTAS y todavía no cerraron. Una licitación
 * vencida en la lista es una promesa rota: el proveedor entra, escribe y recién
 * ahí se entera de que ya no puede cotizar.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, MapPin, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LaburoWordmark } from "@/components/laburo-wordmark";

export const metadata: Metadata = {
  title: "Licitaciones abiertas | LABURO",
  description:
    "Productoras pidiendo presupuesto ahora. Mirá lo que necesitan y mandá el tuyo, sin cuenta.",
};

// Se rearma cada 5 minutos: es una lista pública que cambia poco y la puede
// abrir cualquiera. Sin esto, cada visita pega contra la base.
export const revalidate = 300;

const fmt = (iso: unknown, conHora = false) => {
  if (!iso) return null;
  const d = new Date(String(iso));
  const tz = "America/Argentina/Buenos_Aires";
  const dia = new Intl.DateTimeFormat("es-AR", { day: "numeric", timeZone: tz }).format(d);
  const mes = new Intl.DateTimeFormat("es-AR", { month: "long", timeZone: tz }).format(d);
  const base = `${dia} de ${mes}`;
  if (!conHora) return base;
  // 24 horas: "04:17 p. m." obliga a traducir mentalmente, y en un cierre de
  // licitacion la hora es justo lo que no se puede leer mal.
  const hora = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz,
  }).format(d);
  return `${base} a las ${hora}`;
};

export default async function LicitacionesPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("staff_app_licitaciones_abiertas", { p_limit: 40 });
  const lista = (Array.isArray(data) ? data : []) as Record<string, unknown>[];

  return (
    <main className="min-h-dvh bg-black text-[#e5e2e1] px-6 py-14 md:py-20">
      <div className="max-w-[860px] mx-auto flex flex-col gap-10">
        <div className="flex flex-col gap-6">
          <Link href="/" aria-label="LABURO">
            <LaburoWordmark className="h-[28px] md:h-[34px] w-auto" priority />
          </Link>
          <div>
            <h1 className="font-[family-name:var(--font-syne)] text-[32px] md:text-[46px] font-bold uppercase tracking-tight leading-[1.05]">
              Licitaciones abiertas
            </h1>
            <p className="text-[17px] leading-[1.7] text-[#8a8a8a] mt-4 max-w-[560px]">
              Productoras pidiendo presupuesto ahora mismo. Entrá, mirá qué
              necesitan y mandá el tuyo. No hace falta tener cuenta.
            </p>
          </div>
        </div>

        {lista.length === 0 ? (
          /* ⚠️ El vacío se dice, no se disimula: una lista vacía sin explicación
             se lee como una página rota. */
          <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-8 flex flex-col gap-4">
            <p className="text-[17px] leading-[1.7] text-[#cfc4c5]">
              Ahora mismo no hay ninguna licitación abierta.
            </p>
            <p className="text-[15px] leading-[1.7] text-[#8a8a8a]">
              Publicá tus servicios en LABURO y te avisamos cuando una productora
              pida presupuesto de lo tuyo.
            </p>
            <Link
              href="/registrar-proveedor"
              className="self-start mt-2 inline-flex items-center gap-3 border border-[#4c4546] px-7 py-4 label-tech text-[12px] uppercase tracking-[0.1em] hover:border-[#0047ff] hover:text-[#0047ff] transition-colors"
            >
              Publicar mis servicios <ArrowRight size={15} />
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {lista.map((l) => {
              const donde = [l.ciudad, l.provincia].filter(Boolean).join(", ");
              return (
                <li key={String(l.slug)}>
                  <Link
                    href={`/licitaciones/${String(l.slug)}`}
                    className="group border border-[#1a1a1a] bg-[#0a0a0a] p-6 md:p-8 flex items-center justify-between gap-6 hover:border-[#0047ff] transition-colors duration-300"
                  >
                    <div className="min-w-0">
                      <p className="label-tech text-[11px] uppercase tracking-[0.2em] text-[#0047ff]">
                        {String(l.quien)}
                      </p>
                      <h2 className="font-[family-name:var(--font-syne)] text-[20px] md:text-[24px] font-bold uppercase tracking-tight mt-2">
                        {String(l.titulo)}
                      </h2>
                      <div className="flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-[#8a8a8a] mt-3">
                        {l.categoria ? (
                          <span className="flex items-center gap-2">
                            <Tag size={13} /> {String(l.categoria)}
                          </span>
                        ) : null}
                        {donde ? (
                          <span className="flex items-center gap-2">
                            <MapPin size={13} /> {donde}
                          </span>
                        ) : null}
                        {l.cierra_at ? (
                          <span className="flex items-center gap-2">
                            <Clock size={13} /> Cierra el {fmt(l.cierra_at, true)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <ArrowRight
                      size={22}
                      className="shrink-0 text-[#8a8a8a] group-hover:text-[#0047ff] transition-colors"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
