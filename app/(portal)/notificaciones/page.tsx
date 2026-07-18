/**
 * Centro de Notificaciones (porteo FIEL de "Centro de Notificaciones - LABURO"
 * de Stitch) con DATOS REALES. Es un feed de ACTIVIDAD derivado de las ofertas
 * del org: cada oferta produce el evento más reciente que la describe (aceptada /
 * rechazada / vencida / vista / enviada), ordenado por fecha desc. Sin tabla de
 * "leídas" en la base, así que se presenta como actividad (no hay estado
 * leído/no-leído persistente ni botón "marcar todas"): sería deshonesto simular
 * persistencia que no existe. El dot solo colorea la severidad del evento.
 *
 * Server component, RLS-scopeado al org del caller (staff_app_offers ya viene
 * scopeada). Estilos exactos de Stitch en valores arbitrarios. Copy en voseo.
 */

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

interface OfferRow {
  id: string;
  gig_id: string | null;
  staff_nombre: string | null;
  staff_apellido: string | null;
  gig_title: string | null;
  role: string | null;
  status: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  responded_at: string | null;
  expires_at: string | null;
}

type Severity = "accepted" | "viewed" | "sent" | "expired" | "declined";

interface Feed {
  key: string;
  at: number; // epoch ms para ordenar
  label: string;
  title: string;
  body: string;
  severity: Severity;
}

/** Nombre visible del candidato (o genérico). */
function nombreDe(o: OfferRow): string {
  const n = [o.staff_nombre, o.staff_apellido].filter(Boolean).join(" ").trim();
  return n || "Un candidato";
}

/** ms de un ISO, o null si vacío/inválido. */
function ms(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Tiempo relativo en es-AR ("hace 2 h", "ayer", "12 oct"). */
function relative(at: number): string {
  const diff = Date.now() - at;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ayer";
  if (d < 7) return `hace ${d} días`;
  return new Date(at).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

/** Deriva el evento más reciente que describe a la oferta. */
function toFeed(o: OfferRow): Feed | null {
  const nombre = nombreDe(o);
  const gig = (o.gig_title ?? "").trim() || "un evento";
  const rol = (o.role ?? "").trim();
  const paraRol = rol ? ` para ${rol}` : "";

  if (o.status === "accepted") {
    const at = ms(o.responded_at) ?? ms(o.sent_at);
    if (at !== null)
      return {
        key: o.id,
        at,
        label: "OFERTA ACEPTADA",
        title: `${nombre} aceptó tu oferta`,
        body: `Confirmó${paraRol} en ${gig}. Ya quedó como staff del evento.`,
        severity: "accepted",
      };
  }
  if (o.status === "declined") {
    const at = ms(o.responded_at) ?? ms(o.sent_at);
    if (at !== null)
      return {
        key: o.id,
        at,
        label: "OFERTA RECHAZADA",
        title: `${nombre} rechazó tu oferta`,
        body: `No va a estar disponible${paraRol} en ${gig}.`,
        severity: "declined",
      };
  }

  const expMs = ms(o.expires_at);
  const vencida =
    expMs !== null &&
    expMs <= Date.now() &&
    o.status !== "accepted" &&
    o.status !== "declined";
  if (vencida) {
    return {
      key: o.id,
      at: expMs,
      label: "OFERTA VENCIDA",
      title: `Venció la oferta a ${nombre}`,
      body: `No respondió a tiempo${paraRol} en ${gig}. Podés reenviarla desde su perfil.`,
      severity: "expired",
    };
  }

  if (o.status === "viewed") {
    const at = ms(o.viewed_at) ?? ms(o.sent_at);
    if (at !== null)
      return {
        key: o.id,
        at,
        label: "OFERTA VISTA",
        title: `${nombre} vio tu oferta`,
        body: `Abrió el link${paraRol} en ${gig} pero todavía no respondió.`,
        severity: "viewed",
      };
  }

  const sentMs = ms(o.sent_at);
  if (sentMs !== null) {
    return {
      key: o.id,
      at: sentMs,
      label: "OFERTA ENVIADA",
      title: `Le enviaste una oferta a ${nombre}`,
      body: `Esperando respuesta${paraRol} en ${gig}.`,
      severity: "sent",
    };
  }
  return null;
}

function Dot({ severity }: { severity: Severity }) {
  const base = "mt-2 w-2 h-2 rounded-full shrink-0";
  switch (severity) {
    case "accepted":
      return <div className={`${base} bg-[#e5e2e1]`} />;
    case "expired":
      return <div className={`${base} bg-[#ffb4ab]`} />;
    case "viewed":
    case "sent":
      return <div className={`${base} bg-[#e5e2e1] opacity-40`} />;
    default: // declined
      return <div className={`${base} bg-transparent border border-[#4c4546]`} />;
  }
}

export default async function NotificacionesPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("staff_app_offers")
    .select(
      "id,gig_id,staff_nombre,staff_apellido,gig_title,role,status,sent_at,viewed_at,responded_at,expires_at",
    );

  const offers = (data ?? []) as OfferRow[];
  const feed = offers
    .map(toFeed)
    .filter((f): f is Feed => f !== null)
    .sort((a, b) => b.at - a.at);

  return (
    <div className="max-w-[1440px] mx-auto w-full px-6 md:px-20 py-24 md:py-40 grid grid-cols-12 gap-8 relative">
      {/* Header */}
      <header className="col-span-12 mb-12 border-b border-[#353535] pb-6">
        <h1 className="font-[family-name:var(--font-syne)] text-[clamp(1.9rem,8vw,120px)] font-extrabold leading-[1.05] tracking-[-0.04em] text-[#e5e2e1] break-words">
          NOTIFICACIONES
        </h1>
      </header>

      {/* Feed */}
      <div className="col-span-12 md:col-span-8 lg:col-span-6 md:col-start-3 lg:col-start-4">
        {feed.length === 0 ? (
          <div className="border-t border-b border-[#353535] py-20 text-center">
            <p className="text-[16px] text-[#cfc4c5] max-w-[420px] mx-auto">
              No hay actividad todavía. Cuando envíes ofertas, acá vas a ver
              cuándo las ven, las aceptan o vencen.
            </p>
            <Link
              href="/buscar"
              className="mt-6 inline-block label-tech text-[12px] text-[#e5e2e1] hover:opacity-70 border-b border-[#353535] pb-1"
            >
              Buscar staff
            </Link>
          </div>
        ) : (
          <div className="flex flex-col">
            {feed.map((n) => (
              <div
                key={n.key}
                className={`group relative py-6 border-b border-[#353535] hover:border-[#4c4546] transition-colors duration-150 flex items-start gap-4 ${
                  n.severity === "declined" ? "opacity-60 hover:opacity-100" : ""
                }`}
              >
                <Dot severity={n.severity} />
                <div className="flex-1">
                  <div className="flex justify-between items-baseline mb-2 gap-4">
                    <span
                      className={`label-tech text-[12px] ${
                        n.severity === "expired" ? "text-[#ffb4ab]" : "text-[#cfc4c5]"
                      }`}
                    >
                      {n.label}
                    </span>
                    <span className="label-tech text-[12px] text-[#4c4546] shrink-0">
                      {relative(n.at)}
                    </span>
                  </div>
                  <h2 className="font-[family-name:var(--font-syne)] text-[26px] md:text-[32px] font-semibold leading-[1.2] tracking-[-0.01em] text-[#e5e2e1]">
                    {n.title}
                  </h2>
                  <p className="mt-2 text-[16px] leading-[1.6] text-[#cfc4c5] max-w-[448px]">
                    {n.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
