/**
 * Dashboard de la productora, con DATOS REALES: cuenta de eventos activos,
 * personas confirmadas del próximo evento (ofertas aceptadas), y lista de
 * eventos activos con su staff asignado. Server component, RLS-scopeado al org
 * del caller.
 *
 * EL COPY HABLA EN LA VOZ DE ELLA (31/7). El porteo de Stitch traía un eyebrow
 * y un título escritos desde una agencia mirando a su cliente, no desde la
 * productora mirando su propia operación. Esta es la primera pantalla que ve al
 * entrar, y era una de las razones por las que el portal no se reconocía como
 * el producto de la productora.
 */

import Link from "next/link";
import { UserPlus, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fmtFecha } from "@/lib/dates";

interface Gig {
  id: string;
  title: string | null;
  starts_at: string | null;
  ends_at: string | null;
  venue_name: string | null;
  status: string | null;
}

function fmtRange(startIso: string | null, endIso: string | null): string {
  const sv = fmtFecha(startIso);
  const ev = fmtFecha(endIso);
  if (sv && ev) return `${sv} - ${ev}`;
  return sv ?? ev ?? "Sin fecha";
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: gigsData }, { data: offersData }] = await Promise.all([
    supabase
      .from("staff_app_gigs")
      .select("id,title,starts_at,ends_at,venue_name,status")
      .order("starts_at", { ascending: true }),
    supabase.from("staff_app_offers").select("gig_id,status"),
  ]);

  const gigs = (gigsData ?? []) as Gig[];
  const offers = (offersData ?? []) as { gig_id: string | null; status: string | null }[];

  // Confirmados (ofertas aceptadas) por gig.
  const acceptedByGig = new Map<string, number>();
  for (const o of offers) {
    if (o.status === "accepted" && o.gig_id) {
      acceptedByGig.set(o.gig_id, (acceptedByGig.get(o.gig_id) ?? 0) + 1);
    }
  }

  const now = Date.now();
  const isActive = (g: Gig) => {
    const ref = g.ends_at ?? g.starts_at;
    if (!ref) return true; // sin fecha = lo tratamos como activo
    const t = new Date(ref).getTime();
    return Number.isNaN(t) ? true : t >= now - 24 * 3600 * 1000;
  };

  const activeGigs = gigs.filter(isActive);
  const activeCount = activeGigs.length;
  const nextGig = activeGigs[0] ?? gigs[0] ?? null;
  const confirmedNext = nextGig ? acceptedByGig.get(nextGig.id) ?? 0 : 0;

  // Próximo hito: cuándo arranca el próximo evento.
  let hito = "Sin eventos próximos.";
  if (nextGig?.starts_at) {
    const t = new Date(nextGig.starts_at).getTime();
    if (!Number.isNaN(t)) {
      const days = Math.ceil((t - now) / (24 * 3600 * 1000));
      hito =
        days <= 0
          ? `${nextGig.title ?? "El evento"} en curso.`
          : days === 1
            ? `${nextGig.title ?? "Próximo evento"} arranca mañana.`
            : `${nextGig.title ?? "Próximo evento"} arranca en ${days} días.`;
    }
  }

  return (
    <div className="max-w-[1440px] mx-auto w-full px-6 md:px-20 py-16 md:py-24">
      {/* Header */}
      <header className="mb-12 border-b border-[#1A1A1A] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <p className="label-tech text-[12px] text-[#cfc4c5] mb-4 tracking-[0.2em] font-bold">
            Tu operación
          </p>
          <h2 className="t-display uppercase text-[#e5e2e1]">
            Tus eventos
          </h2>
        </div>
        <Link
          href="/buscar"
          className="bg-[#F5F5F5] text-black border border-transparent hover:bg-transparent hover:text-[#F5F5F5] hover:border-[#F5F5F5] transition-all duration-150 label-tech text-[12px] py-4 px-8 w-full md:w-auto flex items-center justify-center gap-3"
        >
          <UserPlus size={18} />
          Solicitar Nuevo Staff
        </Link>
      </header>

      {/* Bento */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Hero metric */}
        <article className="col-span-1 md:col-span-8 bg-[#0A0A0A] border border-[#1A1A1A] p-8 md:p-16 flex flex-col justify-between min-h-[400px] relative overflow-hidden">
          {/* Antes acá había una captura de un mock de Stitch como imagen de fondo
              (servida desde googleusercontent): en el celular se veía como una
              pantalla ajena superpuesta y rompía todo. Un degradado limpio de la
              marca hace el mismo trabajo sin ruido. */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#141414] via-[#0A0A0A] to-[#0A0A0A]" />
          <div className="relative z-10">
            <p className="label-tech text-[12px] text-[#cfc4c5] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#e5e2e1] animate-pulse" />
              Próximo Evento: {nextGig?.title?.trim() || "Sin eventos"}
            </p>
          </div>
          <div className="relative z-10 mt-16">
            <h3 className="t-stat text-[#e5e2e1] mb-4">
              {confirmedNext}
            </h3>
            <p className="t-section text-[#e5e2e1] max-w-[440px]">
              {confirmedNext === 1 ? "persona confirmada" : "personas confirmadas"} para tu próximo evento.
            </p>
          </div>
        </article>

        {/* Status panel */}
        <aside className="col-span-1 md:col-span-4 bg-[#0A0A0A] border border-[#1A1A1A] p-8 flex flex-col gap-8">
          <div>
            <h4 className="label-tech text-[12px] text-[#cfc4c5] border-b border-[#1A1A1A] pb-4 mb-4">
              Estado General
            </h4>
            <div className="flex items-baseline gap-4">
              <span className="t-stat-sm text-[#e5e2e1]">
                {activeCount}
              </span>
              <span className="text-[16px] text-[#cfc4c5]">
                {activeCount === 1 ? "Evento Activo" : "Eventos Activos"}
              </span>
            </div>
          </div>
          <div>
            <h4 className="label-tech text-[12px] text-[#cfc4c5] border-b border-[#1A1A1A] pb-4 mb-4">
              Próximo Hito
            </h4>
            <p className="text-[18px] leading-[1.6] text-[#e5e2e1]">{hito}</p>
          </div>
        </aside>
      </div>

      {/* Eventos activos */}
      <section className="mt-24 md:mt-32">
        <header className="mb-6">
          <h3 className="t-section text-[#e5e2e1]">
            Eventos Activos
          </h3>
        </header>

        {activeGigs.length === 0 ? (
          <div className="border-t border-b border-[#1A1A1A] py-12 text-center">
            <p className="text-[16px] text-[#cfc4c5]">Todavía no hay eventos activos.</p>
            <Link href="/buscar" className="mt-4 inline-block label-tech text-[12px] text-[#e5e2e1] hover:opacity-70">
              Buscar staff
            </Link>
          </div>
        ) : (
          <div className="flex flex-col">
            {activeGigs.map((g, i) => (
              <article
                key={g.id}
                className={`group py-6 border-t border-[#1A1A1A] ${i === activeGigs.length - 1 ? "border-b" : ""} transition-colors`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4">
                  <div className="flex-1">
                    <p className="label-tech text-[12px] text-[#cfc4c5] mb-2">
                      {fmtRange(g.starts_at, g.ends_at)}
                    </p>
                    <h4 className="t-section text-[#e5e2e1] uppercase">
                      {g.title?.trim() || "Gig sin título"}
                    </h4>
                    {g.venue_name?.trim() && (
                      <p className="text-[16px] text-[#cfc4c5] mt-2">{g.venue_name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right hidden md:block">
                      <p className="label-tech text-[12px] text-[#cfc4c5]">Staff Confirmado</p>
                      <p className="text-[18px] text-[#e5e2e1]">{acceptedByGig.get(g.id) ?? 0}</p>
                    </div>
                    <Link
                      href="/tablero"
                      className="w-12 h-12 rounded-full border border-[#1A1A1A] flex items-center justify-center text-[#e5e2e1] group-hover:bg-[#e5e2e1] group-hover:text-black transition-all"
                      aria-label={`Ver ${g.title ?? "evento"}`}
                    >
                      <ArrowRight size={20} />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
