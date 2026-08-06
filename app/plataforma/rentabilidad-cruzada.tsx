/**
 * LA PLATA DE TODAS LAS PRODUCTORAS, en una tabla.
 *
 * Franco (6/8): *"yo como SOMOS DER tengo un superpoder, tengo que ver todo de
 * todos, pero el resto solo ve de su producto"*.
 *
 * Esto es lo que `/rentabilidad` muestra para UNA organización, pero para todas.
 * Era la única pieza del "ver todo de todos" que faltaba: el resto de
 * `/plataforma` ya era cruzado desde la 0054.
 *
 * Server component: no tiene un solo estado. El permiso NO se decide acá, lo
 * decide `is_platform_admin()` adentro de la RPC, que a cualquier otro le
 * devuelve una lista vacía.
 *
 * ── POR QUÉ "SIN CARGAR" Y NO "$0" ──────────────────────────────────────────
 * Cuando una productora no cargó cuánto le cobra al cliente, el ingreso viaja en
 * null y el margen no se puede calcular. Se dice "sin cargar". Un $0 puesto sin
 * datos es una mentira que después alguien lee como "esta productora no gana
 * nada", y sobre eso se toman decisiones.
 */

import { money } from "@/lib/format";
import { fmtFecha } from "@/lib/dates";
import type { RentabilidadOrg } from "./actions";

function Celda({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`py-4 pr-6 align-top ${className}`}>{children}</td>;
}

export function RentabilidadCruzada({ filas }: { filas: RentabilidadOrg[] }) {
  const clientes = filas.filter((f) => !f.es_plataforma);

  // Los totales se suman sobre lo que EXISTE, no sobre lo que falta: una
  // productora sin ingreso cargado no baja el total a cero, simplemente no suma.
  const ingreso = clientes.reduce((a, f) => a + (Number(f.ingreso) || 0), 0);
  const costo = clientes.reduce((a, f) => a + (Number(f.costo) || 0), 0);
  const sinCargar = clientes.filter((f) => f.ingreso == null && f.eventos > 0).length;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-syne)] text-[24px] md:text-[30px] font-bold uppercase tracking-tight text-[#e5e2e1]">
          La plata, de todas
        </h2>
        <p className="text-[15px] leading-[1.65] text-[#8a8a8a] max-w-[640px]">
          Cada productora ve solo la suya. Esta es la única pantalla donde se ven
          todas juntas. El ingreso es lo que le cobran al cliente y el costo es
          solo lo que ya aceptó el staff, no lo que está ofertado.
        </p>
      </div>

      {clientes.length === 0 ? (
        <div className="border border-[#2a2a2a] p-8">
          <p className="text-[16px] text-[#8a8a8a] leading-[1.6]">
            Todavía no hay ninguna productora cliente. Cuando se registre la
            primera, sus números aparecen acá solos.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 border border-[#2a2a2a]">
            {[
              { k: "Ingreso de todas", v: money(ingreso) },
              { k: "Costo de staff", v: money(costo) },
              { k: "Margen total", v: money(ingreso - costo) },
            ].map((c, i) => (
              <div
                key={c.k}
                className={`p-6 flex flex-col gap-2 ${i < 2 ? "border-b sm:border-b-0 sm:border-r border-[#2a2a2a]" : ""}`}
              >
                <span className="label-tech text-[10px] uppercase tracking-[0.2em] text-[#8a8a8a]">
                  {c.k}
                </span>
                <span className="font-[family-name:var(--font-syne)] text-[26px] md:text-[32px] font-bold text-[#e5e2e1] [overflow-wrap:anywhere]">
                  {c.v}
                </span>
              </div>
            ))}
          </div>

          {/* La tabla scrollea SOLA y no empuja la página: en un teléfono, seis
              columnas de plata no entran de ninguna manera. */}
          <div className="overflow-x-auto border border-[#2a2a2a]">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="label-tech text-[10px] uppercase tracking-[0.18em] text-[#8a8a8a] border-b border-[#2a2a2a]">
                  <th className="py-4 pl-6 pr-6 font-normal">Productora</th>
                  <th className="py-4 pr-6 font-normal">Eventos</th>
                  <th className="py-4 pr-6 font-normal">Ingreso</th>
                  <th className="py-4 pr-6 font-normal">Costo</th>
                  <th className="py-4 pr-6 font-normal">Margen</th>
                  <th className="py-4 pr-6 font-normal">Contrataciones</th>
                  <th className="py-4 pr-6 font-normal">Último movimiento</th>
                </tr>
              </thead>
              <tbody className="text-[15px] text-[#cfc4c5]">
                {clientes.map((f) => (
                  <tr key={f.id} className="border-b border-[#1a1a1a] last:border-b-0">
                    <Celda className="pl-6">
                      <span className="text-[#e5e2e1] [overflow-wrap:anywhere]">
                        {f.name ?? "Sin nombre"}
                      </span>
                    </Celda>
                    <Celda>{f.eventos}</Celda>
                    <Celda>
                      {f.ingreso == null ? (
                        <span className="text-[#8a8a8a]">sin cargar</span>
                      ) : (
                        money(Number(f.ingreso))
                      )}
                    </Celda>
                    <Celda>{money(Number(f.costo) || 0)}</Celda>
                    <Celda>
                      {f.margen == null ? (
                        <span className="text-[#8a8a8a]">—</span>
                      ) : (
                        <span
                          className={
                            Number(f.margen) < 0 ? "text-[#ff8a8a]" : "text-[#e5e2e1]"
                          }
                        >
                          {money(Number(f.margen))}
                        </span>
                      )}
                    </Celda>
                    <Celda>
                      {f.ofertas_aceptadas} de {f.ofertas_mandadas}
                    </Celda>
                    <Celda>
                      {f.ultimo_movimiento ? (
                        fmtFecha(f.ultimo_movimiento)
                      ) : (
                        <span className="text-[#8a8a8a]">nunca</span>
                      )}
                    </Celda>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sinCargar > 0 ? (
            <p className="text-[13px] leading-[1.6] text-[#8a8a8a]">
              {sinCargar === 1
                ? "Hay 1 productora con eventos y sin el ingreso del cliente cargado, así que su margen no se puede calcular."
                : `Hay ${sinCargar} productoras con eventos y sin el ingreso del cliente cargado, así que su margen no se puede calcular.`}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
