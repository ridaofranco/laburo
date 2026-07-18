/**
 * Panel del STAFF (fork "staff con cuenta") con DATOS REALES. Gate por identidad
 * de staff (requireStaff → perfil por email verificado). Muestra el próximo
 * evento confirmado, la agenda completa de próximos confirmados, las propuestas
 * pendientes, stats reales, y el historial de laburos con ganancias acumuladas y
 * horas fichadas. "Cómo llegar" (Google Maps) por venue. Todo se deriva de las
 * ofertas que ya trae getMyStaffOffers (sin queries nuevas). Chrome propio del
 * staff vía <StaffNav>. Estilos Stitch.
 */

export const dynamic = "force-dynamic";

import Link from "next/link";
import { MapPin, ChevronDown } from "lucide-react";
import { StaffNav } from "@/components/staff-nav";
import { requireStaff, getMyStaffOffers, type StaffOffer } from "@/lib/staff";
import { offerLabel } from "@/lib/offers";
import { PendingOfferActions } from "./pending-offer-actions";
import { fmtFecha, fmtHora as fmtHoraTz } from "@/lib/dates";
import { money } from "@/lib/format";

const SYNE = "font-[family-name:var(--font-syne)]";


function fmtDia(iso: string | null): string {
  return fmtFecha(iso, { day: "2-digit", month: "short", year: "numeric" }) ?? "Fecha a confirmar";
}

function fmtHora(iso: string | null): string | null {
  const h = fmtHoraTz(iso);
  return h ? `${h} hs` : null;
}

/** Link a Google Maps para llegar al venue (sin API key, deep link universal). */
function mapsUrl(venue: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}`;
}

/** Duración fichada "Xh Ym" a partir de check-in/out, o null si falta alguno. */
function duracion(inIso: string | null, outIso: string | null): string | null {
  if (!inIso || !outIso) return null;
  const a = new Date(inIso).getTime();
  const b = new Date(outIso).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return null;
  const min = Math.round((b - a) / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** timestamp para ordenar; los sin fecha van al final (Infinity). */
function ts(iso: string | null): number {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? Infinity : t;
}

export default async function PanelStaffPage() {
  const profile = await requireStaff();
  const offers = await getMyStaffOffers();

  const now = Date.now();
  const cutoff = now - 12 * 3600 * 1000; // margen: un evento de hoy sigue siendo "próximo".
  const accepted = offers.filter((o) => o.status === "accepted");
  const pending = offers.filter((o) => {
    const l = offerLabel(o);
    return l === "Enviada" || l === "Vista";
  });

  // Confirmados a futuro (incluye hoy) y pasados, ordenados.
  const upcoming = accepted
    .filter((o) => ts(o.gig_starts_at) >= cutoff)
    .sort((a, b) => ts(a.gig_starts_at) - ts(b.gig_starts_at));
  const past = accepted
    .filter((o) => o.gig_starts_at != null && ts(o.gig_starts_at) < cutoff)
    .sort((a, b) => ts(b.gig_starts_at) - ts(a.gig_starts_at));

  const next: StaffOffer | null = upcoming[0] ?? accepted[0] ?? null;
  const agenda = upcoming.filter((o) => o.id !== next?.id); // el resto (el próximo va en el hero)
  const totalGanado = past.reduce((s, o) => s + (Number(o.amount) || 0), 0);

  const nombre = (profile.nombre ?? "").trim() || "Hola";
  const eventosRealizados = profile.eventos_trabajados ?? 0;
  const confirmados = accepted.length;

  return (
    <div className="min-h-dvh bg-[#131313] text-[#e5e2e1] antialiased flex flex-col md:flex-row">
      <StaffNav />

      <main className="flex-1 w-full md:pl-[280px] pt-16 md:pt-0 pb-[100px] md:pb-0 relative">
        <div className="max-w-[1440px] mx-auto px-6 md:px-20 py-12 md:py-32 flex flex-col gap-12">
          {/* Hero / próximo evento */}
          <section className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
            <div className="col-span-1 md:col-span-8 flex flex-col gap-2">
              <p className="label-tech text-[12px] uppercase tracking-[0.2em] text-[#c6c6c6]">
                {next ? "Próximo evento" : `Hola, ${nombre}`}
              </p>
              <h2 className={`${SYNE} text-[clamp(2rem,8vw,96px)] font-extrabold text-[#e5e2e1] tracking-tighter leading-[1.02] break-words`}>
                {next ? (next.gig_title?.trim() || "Evento confirmado") : "Todavía sin eventos"}
              </h2>
              {next ? (
                <div className="flex flex-wrap items-center gap-4 mt-4">
                  {next.gig_venue?.trim() && (
                    <>
                      <span className="text-[18px] text-[#cfc4c5]">{next.gig_venue}</span>
                      <span className="w-1 h-1 rounded-full bg-[#4c4546]" />
                    </>
                  )}
                  <span className="text-[18px] text-[#cfc4c5]">{fmtDia(next.gig_starts_at)}</span>
                  {fmtHora(next.gig_starts_at) && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-[#4c4546]" />
                      <span className="text-[18px] text-[#cfc4c5]">{fmtHora(next.gig_starts_at)}</span>
                    </>
                  )}
                  {next.role?.trim() && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-[#4c4546]" />
                      <span className="text-[18px] text-[#cfc4c5]">{next.role}</span>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-[18px] text-[#cfc4c5] mt-4 max-w-[520px] leading-[1.6]">
                  Cuando una agencia te mande una oferta y la confirmes, tu próximo
                  evento aparece acá con la fecha, el lugar y tu rol.
                </p>
              )}
            </div>
            <div className="col-span-1 md:col-span-4 flex flex-col items-start md:items-end gap-3 mt-8 md:mt-0">
              {next && (
                <Link
                  href="/fichaje"
                  className="bg-[#c6c6c6] text-[#303030] label-tech text-[12px] px-10 py-5 uppercase tracking-widest border border-[#c6c6c6] hover:bg-transparent hover:text-[#c6c6c6] transition-all duration-200"
                >
                  Ir a fichar
                </Link>
              )}
              {next?.gig_venue?.trim() && (
                <a
                  href={mapsUrl(next.gig_venue)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 label-tech text-[12px] text-[#cfc4c5] hover:text-[#c6c6c6] uppercase tracking-widest transition-colors"
                >
                  <MapPin size={14} /> Cómo llegar
                </a>
              )}
              <Link
                href="/editar-perfil-staff"
                className="label-tech text-[12px] text-[#cfc4c5] hover:text-[#c6c6c6] uppercase tracking-widest transition-colors"
              >
                Editar mi perfil
              </Link>
            </div>
          </section>

          {/* Mi agenda: el resto de los confirmados a futuro (el próximo está en el hero) */}
          {agenda.length > 0 && (
            <section className="flex flex-col gap-6">
              <div className="flex justify-between items-end border-b border-[#1A1A1A] pb-4">
                <h3 className={`${SYNE} text-[28px] md:text-[56px] font-bold text-[#e5e2e1] tracking-tight`}>
                  Mi agenda
                </h3>
                <span className="label-tech text-[12px] text-[#cfc4c5] uppercase tracking-widest">
                  {agenda.length} {agenda.length === 1 ? "evento más" : "eventos más"}
                </span>
              </div>
              <div className="flex flex-col">
                {agenda.map((o) => (
                  <div
                    key={o.id}
                    className="flex flex-col md:flex-row justify-between md:items-center py-6 border-b border-[#1A1A1A] gap-3 md:gap-6"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="label-tech text-[12px] text-[#cfc4c5] uppercase">
                        {fmtDia(o.gig_starts_at)}
                        {fmtHora(o.gig_starts_at) ? ` · ${fmtHora(o.gig_starts_at)}` : ""}
                      </span>
                      <h4 className="text-[18px] font-semibold text-[#e5e2e1]">
                        {o.gig_title?.trim() || "Evento"}
                      </h4>
                      <span className="text-[15px] text-[#cfc4c5]">
                        {o.role?.trim() || "Rol a confirmar"}
                        {o.gig_venue?.trim() ? ` • ${o.gig_venue}` : ""}
                        {o.amount != null && Number(o.amount) > 0 ? ` • ${money(Number(o.amount))}` : ""}
                      </span>
                    </div>
                    {o.gig_venue?.trim() && (
                      <a
                        href={mapsUrl(o.gig_venue)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 label-tech text-[11px] uppercase tracking-widest text-[#cfc4c5] hover:text-[#c6c6c6] border border-[#4c4546] hover:border-[#c6c6c6] px-4 py-2 transition-colors w-fit shrink-0"
                      >
                        <MapPin size={14} /> Cómo llegar
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Stats reales */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-0 border-y border-[#4c4546]/20 py-12 my-4">
            <div className="flex flex-col gap-4 items-center justify-center border-b md:border-b-0 md:border-r border-[#1A1A1A] pb-10 md:pb-0">
              <span className={`${SYNE} text-[80px] md:text-[120px] font-extrabold text-[#c6c6c6] leading-none`}>
                {eventosRealizados}
              </span>
              <span className="label-tech text-[12px] uppercase text-[#cfc4c5] tracking-widest">
                Eventos realizados
              </span>
            </div>
            <div className="flex flex-col gap-4 items-center justify-center pt-10 md:pt-0">
              <span className={`${SYNE} text-[80px] md:text-[120px] font-extrabold text-[#c6c6c6] leading-none`}>
                {confirmados}
              </span>
              <span className="label-tech text-[12px] uppercase text-[#cfc4c5] tracking-widest">
                {confirmados === 1 ? "Evento confirmado" : "Eventos confirmados"}
              </span>
            </div>
          </section>

          {/* Propuestas pendientes reales */}
          <section className="flex flex-col gap-6 mt-6">
            <div className="flex justify-between items-end border-b border-[#1A1A1A] pb-4">
              <h3 className={`${SYNE} text-[28px] md:text-[56px] font-bold text-[#e5e2e1] tracking-tight`}>
                Propuestas pendientes
              </h3>
              {pending.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#c6c6c6]" />
                  <span className="label-tech text-[12px] text-[#c6c6c6] uppercase tracking-widest">
                    {pending.length} {pending.length === 1 ? "nueva" : "nuevas"}
                  </span>
                </div>
              )}
            </div>

            {pending.length === 0 ? (
              <p className="text-[16px] text-[#cfc4c5] py-6">
                No tenés propuestas pendientes. Cuando te llegue una oferta, la
                confirmás desde el link que te mandan por email o WhatsApp.
              </p>
            ) : (
              <div className="flex flex-col">
                {pending.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col md:flex-row justify-between items-start md:items-center py-6 border-b border-[#1A1A1A] gap-4 md:gap-0"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="label-tech text-[12px] text-[#cfc4c5] uppercase">
                        {fmtDia(p.gig_starts_at)}
                      </span>
                      <h4 className="text-[18px] font-semibold text-[#e5e2e1]">
                        {p.gig_title?.trim() || "Evento"}
                      </h4>
                      <span className="text-[16px] text-[#cfc4c5]">
                        {p.role?.trim() || "Rol a confirmar"}
                        {p.gig_venue?.trim() ? ` • ${p.gig_venue}` : ""}
                        {p.amount != null && Number(p.amount) > 0
                          ? ` • ${money(Number(p.amount))}`
                          : ""}
                      </span>
                    </div>
                    <PendingOfferActions offerId={p.id} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Historial de laburos (colapsable): eventos pasados + ganancias + horas fichadas */}
          {past.length > 0 && (
            <section className="flex flex-col">
              <details className="group">
                <summary className="flex justify-between items-end border-b border-[#1A1A1A] pb-4 cursor-pointer list-none">
                  <div className="flex flex-col gap-1">
                    <h3 className={`${SYNE} text-[28px] md:text-[56px] font-bold text-[#e5e2e1] tracking-tight`}>
                      Historial
                    </h3>
                    {totalGanado > 0 ? (
                      <span className="text-[15px] text-[#cfc4c5]">
                        Ganaste{" "}
                        <span className="text-[#c6c6c6] font-semibold">{money(totalGanado)}</span>{" "}
                        con SOMOS DER
                      </span>
                    ) : (
                      <span className="text-[15px] text-[#cfc4c5]">
                        {past.length} {past.length === 1 ? "evento trabajado" : "eventos trabajados"}
                      </span>
                    )}
                  </div>
                  <ChevronDown
                    size={22}
                    className="text-[#c6c6c6] transition-transform group-open:rotate-180 mb-2 shrink-0"
                  />
                </summary>
                <div className="flex flex-col pt-2">
                  {past.map((o) => {
                    const dur = duracion(o.check_in_at, o.check_out_at);
                    return (
                      <div
                        key={o.id}
                        className="flex flex-col md:flex-row justify-between md:items-center py-5 border-b border-[#1A1A1A] gap-2 md:gap-6"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="label-tech text-[12px] text-[#cfc4c5] uppercase">
                            {fmtDia(o.gig_starts_at)}
                          </span>
                          <h4 className="text-[17px] font-semibold text-[#e5e2e1]">
                            {o.gig_title?.trim() || "Evento"}
                          </h4>
                          <span className="text-[14px] text-[#cfc4c5]">
                            {o.role?.trim() || "—"}
                            {dur ? ` • ${dur} fichadas` : ""}
                          </span>
                        </div>
                        {o.amount != null && Number(o.amount) > 0 && (
                          <span className="text-[16px] text-[#c6c6c6] font-semibold shrink-0">
                            {money(Number(o.amount))}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </details>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
