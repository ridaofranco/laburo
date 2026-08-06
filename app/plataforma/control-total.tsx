/**
 * CONTROL TOTAL: qué pasó en LABURO, quién consultó a quién, y en qué quedó cada
 * oferta.
 *
 * Franco (6/8): *"el superpoder me tiene que dar control total de la aplicación,
 * completo, absolutamente todo tengo que ver, no se me puede pasar nada"*.
 *
 * Server component: no tiene un solo estado. El permiso NO se decide acá, lo
 * deciden las RPC con `is_platform_admin()` adentro, que a cualquier otro le
 * devuelven una lista vacía.
 *
 * ── POR QUÉ LA LÍNEA DE TIEMPO VA PRIMERA ───────────────────────────────────
 * Porque es la única que TRAE en vez de obligar a ir a buscar. Las otras dos
 * pantallas contestan preguntas que hay que saber hacerse; esta contesta la
 * única que importa cuando abrís a la mañana, que es "qué pasó". Si algo raro
 * ocurrió, acá aparece sin que nadie lo haya ido a buscar.
 */

import { money } from "@/lib/format";
import { fmtFechaHora } from "@/lib/dates";
import type {
  ConsultaPlataforma,
  OfertaPlataforma,
  HechoPlataforma,
} from "./actions";

/** Cómo se lee cada tipo de hecho, y con qué color. */
const HECHOS: Record<string, { texto: string; color: string }> = {
  persona_nueva: { texto: "se sumó al pool", color: "text-[#8a8a8a]" },
  proveedor_nuevo: { texto: "se publicó como proveedor", color: "text-[#0047ff]" },
  salon_nuevo: { texto: "publicó su salón", color: "text-[#0047ff]" },
  productora_nueva: { texto: "creó su productora", color: "text-[#0047ff]" },
  evento_nuevo: { texto: "cargó un evento", color: "text-[#e5e2e1]" },
  oferta_mandada: { texto: "recibió una oferta", color: "text-[#e5e2e1]" },
  oferta_aceptada: { texto: "ACEPTÓ la oferta", color: "text-positive" },
  oferta_rechazada: { texto: "rechazó la oferta", color: "text-[#ff8a8a]" },
  consulta: { texto: "mandó una consulta", color: "text-[#0047ff]" },
  lead: { texto: "dejó una consulta en la landing", color: "text-[#0047ff]" },
};

/** El estado de una oferta, en criollo. */
const ESTADOS: Record<string, { texto: string; color: string }> = {
  sent: { texto: "Esperando respuesta", color: "text-[#8a8a8a]" },
  viewed: { texto: "La vio", color: "text-[#cfc4c5]" },
  accepted: { texto: "Aceptada", color: "text-positive" },
  declined: { texto: "Rechazada", color: "text-[#ff8a8a]" },
  vencida: { texto: "Venció sin respuesta", color: "text-[#ff8a8a]" },
};

function Titulo({ children, bajada }: { children: React.ReactNode; bajada: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-[family-name:var(--font-syne)] text-[24px] md:text-[30px] font-bold uppercase tracking-tight text-[#e5e2e1]">
        {children}
      </h2>
      <p className="text-[15px] leading-[1.65] text-[#8a8a8a] max-w-[640px]">{bajada}</p>
    </div>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-[#2a2a2a] p-8">
      <p className="text-[16px] text-[#8a8a8a] leading-[1.6]">{children}</p>
    </div>
  );
}

export function ControlTotal({
  hechos,
  consultas,
  ofertas,
}: {
  hechos: HechoPlataforma[];
  consultas: ConsultaPlataforma[];
  ofertas: OfertaPlataforma[];
}) {
  // Las consultas cuyo mail NUNCA salió. Van contadas arriba porque son el
  // único caso de esta pantalla donde hay que HACER algo: alguien pidió un
  // presupuesto y del otro lado no se enteró nadie.
  const mudas = consultas.filter((c) => !c.mail_salio).length;

  return (
    <div className="flex flex-col gap-16">
      {/* ── 1. Qué pasó ─────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-6">
        <Titulo bajada="Todo lo que pasó en los últimos 30 días, de todas las productoras y los cuatro pools, en una sola lista. No hace falta ir a buscar nada.">
          Qué pasó
        </Titulo>

        {hechos.length === 0 ? (
          <Vacio>Todavía no pasó nada en los últimos 30 días.</Vacio>
        ) : (
          <div className="border border-[#2a2a2a] divide-y divide-[#1a1a1a] max-h-[560px] overflow-y-auto">
            {hechos.map((h, i) => {
              const d = HECHOS[h.que] ?? { texto: h.que, color: "text-[#8a8a8a]" };
              return (
                <div
                  key={`${h.cuando}-${i}`}
                  className="px-5 py-4 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4"
                >
                  <span className="label-tech text-[10px] uppercase tracking-[0.15em] text-[#8a8a8a] shrink-0 sm:w-[150px]">
                    {fmtFechaHora(h.cuando)}
                  </span>
                  <span className="text-[15px] text-[#cfc4c5] [overflow-wrap:anywhere]">
                    <span className="text-[#e5e2e1]">{h.quien?.trim() || "Alguien"}</span>{" "}
                    <span className={d.color}>{d.texto}</span>
                    {h.detalle?.trim() ? (
                      <span className="text-[#8a8a8a]"> · {h.detalle}</span>
                    ) : null}
                    {h.org?.trim() ? (
                      <span className="text-[#8a8a8a]"> · {h.org}</span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 2. Quién consultó a quién ───────────────────────────────────── */}
      <section className="flex flex-col gap-6">
        <Titulo bajada="Los pedidos de presupuesto a proveedores y salones, vengan del cliente final o de una productora.">
          Las consultas
        </Titulo>

        {/* Esto es lo único de la pantalla que pide una acción. Va arriba y en
            rojo: una consulta guardada cuyo mail no salió es un pedido de
            presupuesto que nadie del otro lado vio nunca. */}
        {mudas > 0 ? (
          <p className="text-[15px] leading-[1.6] text-[#ff8a8a] border-l-2 border-[#ff8a8a] pl-4">
            {mudas === 1
              ? "Hay 1 consulta cuyo mail NO salió: esa persona pidió un presupuesto y del otro lado no se enteró nadie. Conviene avisar a mano."
              : `Hay ${mudas} consultas cuyo mail NO salió: esas personas pidieron presupuesto y del otro lado no se enteró nadie. Conviene avisar a mano.`}
          </p>
        ) : null}

        {consultas.length === 0 ? (
          <Vacio>Todavía no consultó nadie.</Vacio>
        ) : (
          <div className="overflow-x-auto border border-[#2a2a2a]">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="label-tech text-[10px] uppercase tracking-[0.18em] text-[#8a8a8a] border-b border-[#2a2a2a]">
                  <th className="py-4 pl-5 pr-6 font-normal">Cuándo</th>
                  <th className="py-4 pr-6 font-normal">Quién</th>
                  <th className="py-4 pr-6 font-normal">Le escribió a</th>
                  <th className="py-4 pr-6 font-normal">De dónde</th>
                  <th className="py-4 pr-6 font-normal">Mail</th>
                </tr>
              </thead>
              <tbody className="text-[15px] text-[#cfc4c5]">
                {consultas.map((c) => (
                  <tr key={c.id} className="border-b border-[#1a1a1a] last:border-b-0">
                    <td className="py-4 pl-5 pr-6 align-top whitespace-nowrap text-[#8a8a8a]">
                      {fmtFechaHora(c.created_at)}
                    </td>
                    <td className="py-4 pr-6 align-top">
                      <span className="text-[#e5e2e1] [overflow-wrap:anywhere]">
                        {c.quien ?? "Sin nombre"}
                      </span>
                      <br />
                      <span className="text-[13px] text-[#8a8a8a] [overflow-wrap:anywhere]">
                        {c.email}
                        {c.telefono ? ` · ${c.telefono}` : ""}
                      </span>
                    </td>
                    <td className="py-4 pr-6 align-top [overflow-wrap:anywhere]">
                      {c.a_quien}
                      <br />
                      <span className="text-[13px] text-[#8a8a8a]">
                        {c.tipo_destino === "salon" ? "salón" : "proveedor"}
                      </span>
                    </td>
                    <td className="py-4 pr-6 align-top text-[#8a8a8a]">
                      {c.origen === "cliente"
                        ? "La vidriera"
                        : (c.organizacion ?? "Una productora")}
                    </td>
                    <td className="py-4 pr-6 align-top">
                      {c.mail_salio ? (
                        <span className="text-positive">salió</span>
                      ) : (
                        <span className="text-[#ff8a8a]">NO salió</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── 3. Las ofertas y en qué quedaron ────────────────────────────── */}
      <section className="flex flex-col gap-6">
        <Titulo bajada="Cada oferta de trabajo mandada por cualquier productora, con en qué quedó. Las vencidas se calculan solas: una oferta sin contestar cuya fecha pasó ya está muerta.">
          Las ofertas
        </Titulo>

        {ofertas.length === 0 ? (
          <Vacio>Todavía no se mandó ninguna oferta.</Vacio>
        ) : (
          <div className="overflow-x-auto border border-[#2a2a2a]">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="label-tech text-[10px] uppercase tracking-[0.18em] text-[#8a8a8a] border-b border-[#2a2a2a]">
                  <th className="py-4 pl-5 pr-6 font-normal">Cuándo</th>
                  <th className="py-4 pr-6 font-normal">A quién</th>
                  <th className="py-4 pr-6 font-normal">Evento</th>
                  <th className="py-4 pr-6 font-normal">Productora</th>
                  <th className="py-4 pr-6 font-normal">Monto</th>
                  <th className="py-4 pr-6 font-normal">En qué quedó</th>
                </tr>
              </thead>
              <tbody className="text-[15px] text-[#cfc4c5]">
                {ofertas.map((o) => {
                  const e = ESTADOS[o.estado ?? ""] ?? {
                    texto: o.estado ?? "—",
                    color: "text-[#8a8a8a]",
                  };
                  return (
                    <tr key={o.id} className="border-b border-[#1a1a1a] last:border-b-0">
                      <td className="py-4 pl-5 pr-6 align-top whitespace-nowrap text-[#8a8a8a]">
                        {o.sent_at ? fmtFechaHora(o.sent_at) : "—"}
                      </td>
                      <td className="py-4 pr-6 align-top text-[#e5e2e1] [overflow-wrap:anywhere]">
                        {o.a_quien?.trim() || "—"}
                      </td>
                      <td className="py-4 pr-6 align-top [overflow-wrap:anywhere]">
                        {o.evento ?? "—"}
                      </td>
                      <td className="py-4 pr-6 align-top text-[#8a8a8a] [overflow-wrap:anywhere]">
                        {o.organizacion ?? "—"}
                      </td>
                      <td className="py-4 pr-6 align-top whitespace-nowrap">
                        {o.monto != null ? money(Number(o.monto)) : "—"}
                      </td>
                      <td className={`py-4 pr-6 align-top ${e.color}`}>{e.texto}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
