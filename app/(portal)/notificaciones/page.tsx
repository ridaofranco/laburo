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
 *
 * ── DESDE EL 5/9 TAMBIÉN TRAE LAS COTIZACIONES QUE ENTRARON ─────────────────
 * Un pedido de precio junta respuestas de a una, durante días, y hasta hoy no
 * avisaba ninguna: había que acordarse de volver a mirar la pantalla. Eso es
 * exactamente lo que este módulo vino a arreglar del correo, así que repetirlo
 * adentro del producto no tenía sentido.
 *
 * Las dos fuentes se mezclan en el mismo feed ordenado por fecha, porque para
 * el que mira es la misma pregunta: qué pasó desde la última vez que entré.
 */

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { orgActual } from "@/lib/org";
import { fmtFecha } from "@/lib/dates";
import { fmtMonto } from "@/lib/cotizaciones";
import { LoadError } from "@/components/load-error";

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

/** Una cotización que entró a un pedido de precio. */
interface CotizacionRow {
  quote_id: string;
  request_id: string;
  titulo: string | null;
  proveedor: string | null;
  monto: number | null;
  moneda: string | null;
  estado: string | null;
  updated_at: string | null;
}

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
  return fmtFecha(at) ?? "";
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

/** La cotización, al mismo formato del feed. */
function cotizacionAFeed(c: CotizacionRow): Feed | null {
  const at = ms(c.updated_at);
  if (at === null) return null;
  const quien = (c.proveedor ?? "").trim() || "Un proveedor";
  const que = (c.titulo ?? "").trim() || "un pedido";
  const monto = fmtMonto(c.monto, c.moneda ?? "ARS");

  if (c.estado === "ganadora") {
    return {
      key: `q-${c.quote_id}`,
      at,
      label: "PRESUPUESTO ELEGIDO",
      title: `Elegiste a ${quien}`,
      body: `${monto} por ${que}. Ya le avisamos, a él y a los demás.`,
      severity: "accepted",
    };
  }
  return {
    key: `q-${c.quote_id}`,
    at,
    label: "PRESUPUESTO RECIBIDO",
    title: `${quien} te pasó su precio`,
    body: `${monto} por ${que}. Entrá a compararlo con los demás.`,
    severity: "viewed",
  };
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

  // ⚠️ Scope por organización elegida: sin esto, con dos membresías el feed
  // mezcla los movimientos de las dos productoras y no hay forma de saber cuál
  // es cuál, porque la fila solo dice el evento y la persona.
  const org = await orgActual();
  const orgId = org?.organizationId ?? null;

  let q = supabase
    .from("staff_app_offers")
    .select(
      "id,gig_id,staff_nombre,staff_apellido,gig_title,role,status,sent_at,viewed_at,responded_at,expires_at",
    );
  if (orgId) q = q.eq("organization_id", orgId);
  const { data, error } = await q;

  const offers = (data ?? []) as OfferRow[];

  // Las cotizaciones que entraron a los pedidos de precio. Van por RPC porque
  // staff_app no está expuesto por PostgREST, y con p_org por la misma razón
  // que arriba: sin él, con dos membresías el feed mezcla productoras.
  const { data: cotizacionesData } = await supabase.rpc("staff_app_cotizaciones_recientes", {
    p_org: orgId,
    p_limit: 20,
  });
  const cotizaciones = (cotizacionesData as CotizacionRow[] | null) ?? [];

  const feed = [
    ...offers.map(toFeed),
    ...cotizaciones.map(cotizacionAFeed),
  ]
    .filter((f): f is Feed => f !== null)
    .sort((a, b) => b.at - a.at);

  return (
    <div className="max-w-[1440px] mx-auto w-full px-6 md:px-20 py-24 md:py-40 grid grid-cols-12 gap-8 relative">
      {/* Header */}
      <header className="col-span-12 mb-12 border-b border-[#353535] pb-6">
        <h1 className="t-display text-[#e5e2e1] break-words">
          NOTIFICACIONES
        </h1>
      </header>

      {/* Feed */}
      <div className="col-span-12 md:col-span-8 lg:col-span-6 md:col-start-3 lg:col-start-4">
        {error ? (
          <LoadError what="las notificaciones" />
        ) : feed.length === 0 ? (
          <div className="border-t border-b border-[#353535] py-20 text-center">
            <p className="text-[16px] text-[#cfc4c5] max-w-[420px] mx-auto">
              No hay actividad todavía. Cuando envíes ofertas o pidas precios, acá
              vas a ver cuándo las ven, las aceptan, vencen, y qué presupuestos
              entraron.
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
                  <h2 className="t-section text-[#e5e2e1]">
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
