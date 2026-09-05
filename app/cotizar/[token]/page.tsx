/**
 * /cotizar/[token] — LA PANTALLA MÁS IMPORTANTE DEL PRODUCTO.
 *
 * De acá salen los 2 de 370. Todo lo demás (crear el pedido, invitar, comparar)
 * no vale nada si el que abre este link no deja un número.
 *
 * ── POR QUÉ VIVE ACÁ Y NO ADENTRO DEL PORTAL ────────────────────────────────
 * A nivel raíz, fuera de (portal) y de (app): el que llega NO tiene cuenta ni
 * sesión, y el layout del portal lo mandaría a /entrar. `/cotizar` está en la
 * lista de rutas públicas del middleware. Mismo lugar y misma razón que `/o`.
 *
 * ── EL GATE ES EL TOKEN, Y VIVE EN LA BASE ──────────────────────────────────
 * `staff_app_ver_invitacion` es SECURITY DEFINER con search_path fijo, busca por
 * el sha256 del token y devuelve UNA fila: el pedido, quién lo pide y la
 * cotización propia. Nunca cuántos más fueron invitados ni qué cotizaron. Un
 * token que no existe y uno vencido devuelven el MISMO motivo: quien prueba
 * tokens no aprende nada.
 *
 * ── CARGAR EL PRECIO ES POST, SIEMPRE ───────────────────────────────────────
 * Este GET solo marca `visto_at`. La cotización se manda por Server Action, así
 * que ningún preview de link de WhatsApp o de Gmail puede dejar un precio.
 */

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { LaburoWordmark } from "@/components/laburo-wordmark";
import { fmtFecha, fmtFechaHora } from "@/lib/dates";
import { CotizarForm } from "./cotizar-client";

export const metadata: Metadata = {
  title: "LABURO. | Cargar presupuesto",
  robots: { index: false, follow: false },
};

interface Invitacion {
  ok: boolean;
  reason?: string;
  invitado?: { nombre: string | null; email: string };
  pide?: { organizacion: string };
  pedido?: {
    titulo: string;
    descripcion: string | null;
    categoria: string | null;
    provincia: string | null;
    ciudad: string | null;
    necesario_para: string | null;
    cierra_at: string;
    campos: { clave: string; etiqueta: string }[];
    estado: string;
  };
  puede_cotizar?: boolean;
  mi_cotizacion?: {
    monto: number;
    moneda: string;
    incluye: string;
    no_incluye: string | null;
    validez_dias: number | null;
    respuestas: Record<string, string>;
    estado: string;
    updated_at: string;
  } | null;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-black text-[#e5e2e1]">
      <header className="px-6 py-6">
        <LaburoWordmark className="h-[24px] w-auto" />
      </header>
      <main className="flex-1 w-full max-w-[560px] mx-auto px-6 pb-16">{children}</main>
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string | null }) {
  const v = (valor ?? "").trim();
  if (!v) return null;
  return (
    <p className="text-[15px] leading-[1.5] text-[#e5e2e1]">
      <span className="text-[#8A8A8A]">{label}: </span>
      {v}
    </p>
  );
}

export default async function CotizarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc("staff_app_ver_invitacion", { p_token: token });
  const inv = (data as Invitacion | null) ?? { ok: false };

  if (!inv.ok || !inv.pedido) {
    return (
      <Shell>
        <div className="border border-[#222] bg-[#0A0A0A] p-8 flex flex-col gap-3 mt-8">
          <h1 className="t-section text-[#e5e2e1]">Este link no es válido</h1>
          <p className="text-[16px] text-[#cfc4c5] leading-[1.6]">
            Puede que esté incompleto o que haya pasado mucho tiempo. Probá abrirlo de
            nuevo desde el mail, o respondele a quien te lo mandó y te pasa uno nuevo.
          </p>
        </div>
      </Shell>
    );
  }

  const p = inv.pedido;
  const productora = inv.pide?.organizacion ?? "Una productora";
  const cerrado = !inv.puede_cotizar;
  const yaCotizo = Boolean(inv.mi_cotizacion);
  const gano = inv.mi_cotizacion?.estado === "ganadora";
  const perdio = inv.mi_cotizacion?.estado === "no_elegida";

  return (
    <Shell>
      <div className="flex flex-col gap-6 pt-4">
        <header className="flex flex-col gap-2">
          <p className="label-tech text-[12px] uppercase tracking-[0.2em] text-[#c6c6c6]">
            {productora} te pide un presupuesto
          </p>
          <h1 className="t-display text-[#e5e2e1]">{p.titulo}</h1>
        </header>

        <section className="border border-[#222] bg-[#0A0A0A] p-5 flex flex-col gap-2">
          <Dato label="Rubro" valor={p.categoria} />
          <Dato label="Dónde" valor={[p.ciudad, p.provincia].filter(Boolean).join(", ") || null} />
          <Dato
            label="Para cuándo"
            valor={p.necesario_para ? fmtFecha(p.necesario_para, { day: "2-digit", month: "long", year: "numeric" }) : null}
          />
          <Dato
            label={cerrado ? "Cerró" : "Podés cargarlo hasta"}
            valor={fmtFechaHora(p.cierra_at, {
              weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit",
            })}
          />
          {p.descripcion ? (
            <p className="text-[15px] text-[#cfc4c5] leading-[1.6] whitespace-pre-line border-l-2 border-[#4c4546] pl-4 mt-2">
              {p.descripcion}
            </p>
          ) : null}
        </section>

        {/* Cerrado: se dice cómo terminó, que es lo que el que cotizó vino a ver. */}
        {cerrado ? (
          <section className="border border-[#222] bg-[#0A0A0A] p-6 flex flex-col gap-3">
            <h2 className="text-[20px] text-[#e5e2e1]">
              {gano
                ? "Tu presupuesto es el elegido"
                : perdio
                  ? "Esta vez no quedó el tuyo"
                  : p.estado === "cancelada"
                    ? "El pedido se canceló"
                    : "El pedido ya está cerrado"}
            </h2>
            <p className="text-[15px] text-[#cfc4c5] leading-[1.6]">
              {gano
                ? `${productora} eligió tu presupuesto. Te van a escribir para coordinar los detalles.`
                : perdio
                  ? "Gracias por tomarte el trabajo de cotizar: sin tu número no había con qué comparar."
                  : yaCotizo
                    ? "Ya no se pueden cargar ni corregir presupuestos. Cuando decidan, te avisamos por mail."
                    : "Se cerró antes de que llegaras a cargar tu presupuesto."}
            </p>
            {yaCotizo && inv.mi_cotizacion ? (
              <p className="text-[15px] text-[#8A8A8A]">
                Lo último que cargaste: {inv.mi_cotizacion.moneda === "USD" ? "USD " : "$"}
                {Number(inv.mi_cotizacion.monto).toLocaleString("es-AR")}.
              </p>
            ) : null}
          </section>
        ) : (
          <CotizarForm
            token={token}
            campos={p.campos ?? []}
            inicial={inv.mi_cotizacion ?? null}
            productora={productora}
          />
        )}

        <p className="text-[13px] text-[#8A8A8A] leading-[1.6]">
          Tu precio lo ve solo {productora}. Ningún otro proveedor puede verlo, ni saber
          quiénes más recibieron este pedido.
        </p>
      </div>
    </Shell>
  );
}
