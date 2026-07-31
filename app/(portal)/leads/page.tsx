/**
 * LEADS — las consultas de productores que entran por la landing pública.
 *
 * POR QUÉ EXISTE: el formulario de "/" es la única puerta comercial del
 * producto, y hasta el 30/7/2026 el lead solo salía por mail a MAIL_ADMIN_TO. Si
 * el mail fallaba, el lead se perdía; y aunque saliera, quedaba enterrado en una
 * casilla. Ahora el lead se guarda ANTES de intentar el mail
 * (app/landing/actions.ts → staff_app.producer_leads) y esta pantalla es donde
 * se mira: lo más nuevo arriba, con el estado a la vista y un click para
 * responder por mail o por WhatsApp.
 *
 * Server component, RLS-scopeado al org del caller (la vista
 * staff_app_producer_leads es security_invoker).
 *
 * ⚠️ TOLERA QUE FALTE LA MIGRACIÓN 0039: mientras no esté aplicada, la vista no
 * existe y la query devuelve error. En vez de un 500, la pantalla lo dice con
 * todas las letras y explica qué hacer. Los leads mientras tanto siguen
 * llegando por mail.
 */

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtFechaHora } from "@/lib/dates";
import { waLink } from "@/lib/wa";
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import { LeadEstadoBoton } from "./lead-estado-boton";
import type { LeadEstado } from "./lead-actions";

interface LeadRow {
  id: string;
  nombre: string | null;
  empresa: string | null;
  email: string | null;
  telefono: string | null;
  mensaje: string | null;
  origen: string | null;
  estado: string | null;
  contactado_at: string | null;
  created_at: string;
}

const ESTADOS: Record<string, { label: string; cls: string }> = {
  nuevo: { label: "Nuevo", cls: "text-[#0047ff]" },
  contactado: { label: "Contactado", cls: "text-[#3dd68c]" },
  descartado: { label: "Descartado", cls: "text-[#8a8a8a]" },
};

function esEstado(v: string | null): LeadEstado {
  return v === "contactado" || v === "descartado" ? v : "nuevo";
}

export default async function LeadsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("staff_app_producer_leads")
    .select(
      "id,nombre,empresa,email,telefono,mensaje,origen,estado,contactado_at,created_at",
    )
    .order("created_at", { ascending: false });

  const leads = (data ?? []) as LeadRow[];
  const nuevos = leads.filter((l) => esEstado(l.estado) === "nuevo").length;

  return (
    <div className="max-w-[1440px] mx-auto w-full px-6 md:px-20 py-16 md:py-24">
      <div className="mb-10">
        <h2 className="t-display text-[#c6c6c6]">
          Leads
        </h2>
        <p className="text-[16px] text-[#cfc4c5] mt-4 max-w-[620px] leading-[1.6]">
          Las consultas que dejan los productores en la landing. Se guardan acá
          apenas se envían, antes de cualquier mail: si el mail falla, el lead
          sigue estando.
        </p>
        {!error && leads.length > 0 && (
          <p className="label-tech text-[12px] text-[#8a8a8a] mt-4">
            {leads.length} {leads.length === 1 ? "consulta" : "consultas"}
            {nuevos > 0 ? ` · ${nuevos} sin contactar` : ""}
          </p>
        )}
      </div>

      {error ? (
        // No es un LoadError genérico a propósito: el motivo casi seguro es que
        // la 0039 no está aplicada, y eso se arregla en dos minutos si se sabe.
        <div className="border border-[#4c4546] bg-[#0e0e0e] p-8">
          <p className="text-[16px] text-[#e5e2e1]">
            Todavía no se pueden mostrar los leads.
          </p>
          <p className="mt-3 text-[14px] leading-[1.7] text-[#cfc4c5] max-w-[640px]">
            Lo más probable es que falte aplicar la migración{" "}
            <span className="label-tech text-[12px] text-[#e5e2e1]">
              staff_app_0039_producer_leads
            </span>{" "}
            en Supabase (está como archivo en{" "}
            <span className="label-tech text-[12px] text-[#e5e2e1]">
              supabase/migrations/
            </span>
            , sin aplicar). Hasta que se corra, las consultas de la landing
            siguen llegando por mail a las casillas internas: no se pierde
            ninguna, pero no se listan acá.
          </p>
          <p className="mt-3 label-tech text-[11px] text-[#4c4546]">{error.message}</p>
        </div>
      ) : leads.length === 0 ? (
        <div className="border-t border-b border-[#353535] py-20 text-center">
          <p className="text-[16px] text-[#cfc4c5] max-w-[460px] mx-auto leading-[1.6]">
            Todavía no entró ninguna consulta. Cuando un productor complete el
            formulario de la landing, aparece acá al instante.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block label-tech text-[12px] text-[#e5e2e1] hover:opacity-70 border-b border-[#353535] pb-1"
          >
            Ver la landing
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col border-t border-[#353535]">
          {leads.map((l) => {
            const estado = esEstado(l.estado);
            const badge = ESTADOS[estado];
            const nombre = (l.nombre ?? "").trim() || "Sin nombre";
            const email = (l.email ?? "").trim();
            const telefono = (l.telefono ?? "").trim();
            const empresa = (l.empresa ?? "").trim();
            const mensaje = (l.mensaje ?? "").trim();
            return (
              <li
                key={l.id}
                className={`py-6 border-b border-[#353535] ${
                  estado === "descartado" ? "opacity-50 hover:opacity-100 transition-opacity" : ""
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 min-w-0">
                    <span className={`label-tech text-[11px] ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <h3 className="font-[family-name:var(--font-syne)] text-[24px] md:text-[28px] font-semibold leading-[1.2] tracking-[-0.01em] text-[#e5e2e1]">
                      {nombre}
                    </h3>
                    {empresa && (
                      <span className="text-[15px] text-[#cfc4c5]">· {empresa}</span>
                    )}
                  </div>
                  <span className="label-tech text-[11px] text-[#4c4546] shrink-0">
                    {fmtFechaHora(l.created_at) ?? "—"}
                    {(l.origen ?? "").trim() && (l.origen ?? "") !== "landing"
                      ? ` · ${l.origen}`
                      : ""}
                  </span>
                </div>

                {mensaje && (
                  <p className="text-[16px] leading-[1.7] text-[#cfc4c5] max-w-[720px] whitespace-pre-wrap">
                    {mensaje}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
                  {email && (
                    <a
                      href={`mailto:${email}?subject=${encodeURIComponent(
                        "LABURO · tu consulta",
                      )}`}
                      className="label-tech text-[11px] text-[#e5e2e1] border-b border-[#353535] pb-1 hover:border-[#e5e2e1] transition-colors"
                    >
                      {email}
                    </a>
                  )}
                  {telefono && (
                    <a
                      href={waLink(
                        telefono,
                        `Hola ${nombre.split(" ")[0]}, te escribo de LABURO (SOMOS DER) por la consulta que dejaste en la web. ¿Te viene bien que coordinemos por acá?`,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 label-tech text-[11px] text-[#25D366] hover:opacity-70 transition-opacity"
                    >
                      <WhatsAppGlyph size={14} className="shrink-0" />
                      {telefono}
                    </a>
                  )}
                  {l.contactado_at && (
                    <span className="label-tech text-[11px] text-[#4c4546]">
                      Contactado el {fmtFechaHora(l.contactado_at) ?? "—"}
                    </span>
                  )}
                  <div className="ml-auto">
                    <LeadEstadoBoton leadId={l.id} estado={estado} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
