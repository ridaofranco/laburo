"use client";

/**
 * El panel de SOMOS DER como plataforma. Tres bloques, en el orden en que
 * importan: qué hay que mirar ya (búsquedas con señal), quién contrató a quién
 * (el momento que de verdad importa) y quiénes son las productoras.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, EyeOff, RotateCcw } from "lucide-react";
import { money } from "@/lib/format";
import { fmtFecha } from "@/lib/dates";
import { senalesDeRiesgo } from "@/lib/senales-riesgo";
import {
  moderar,
  type BusquedaPlataforma,
  type Contratacion,
  type OrgPlataforma,
  type Resumen,
} from "./actions";

function dia(iso: string | null): string {
  return fmtFecha(iso, { day: "2-digit", month: "short", year: "numeric" }) ?? "—";
}

function Dato({ n, label }: { n: number | undefined; label: string }) {
  return (
    <div className="flex flex-col gap-1 border border-[#4c4546]/40 px-5 py-4">
      <span className="t-stat text-[#e5e2e1] text-[28px] leading-none">{n ?? 0}</span>
      <span className="label-tech text-[11px] uppercase tracking-widest text-[#988e90]">
        {label}
      </span>
    </div>
  );
}

function FilaBusqueda({ b }: { b: BusquedaPlataforma }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const senales = senalesDeRiesgo({ role: b.role, notas: b.notas, pago: b.pago });
  const bajada = b.moderada_at != null;

  async function bajar() {
    const motivo = window.prompt(
      "¿Por qué la bajás? La productora va a ver este motivo.",
      senales[0]?.texto ?? "",
    );
    if (motivo == null) return;
    setBusy(true);
    try {
      const r = await moderar(b.id, true, motivo);
      if (r.ok) {
        toast.success("Búsqueda bajada");
        router.refresh();
      } else toast.error(r.error ?? "No se pudo.");
    } finally {
      setBusy(false);
    }
  }

  async function restituir() {
    setBusy(true);
    try {
      const r = await moderar(b.id, false);
      if (r.ok) {
        toast.success("Búsqueda restituida");
        router.refresh();
      } else toast.error(r.error ?? "No se pudo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 py-5 border-b border-[#1A1A1A]">
      <div className="min-w-0 flex flex-col gap-1">
        <span className="label-tech text-[11px] uppercase tracking-widest text-[#988e90]">
          {b.organizacion} · publicada {dia(b.publicado_at)}
        </span>
        <h4 className="text-[17px] font-semibold text-[#e5e2e1]">
          {b.role}{" "}
          <span className="font-normal text-[#cfc4c5]">
            · {b.gig_title ?? "Evento"}
          </span>
        </h4>
        <span className="text-[14px] text-[#cfc4c5]">
          {b.cupo === 1 ? "1 lugar" : `${b.cupo} lugares`}
          {b.pago != null && Number(b.pago) > 0 ? ` • ${money(Number(b.pago))}` : " • sin pago declarado"}
          {` • ${b.postulados} postulados`}
        </span>
        {b.notas?.trim() ? (
          <p className="text-[13px] text-[#988e90] max-w-[560px]">{b.notas}</p>
        ) : null}

        {senales.length > 0 && !bajada ? (
          <div className="flex flex-col gap-1 mt-2">
            {senales.map((s) => (
              <span
                key={s.clave}
                className={`inline-flex items-center gap-2 text-[13px] ${
                  s.nivel === "alta" ? "text-[#ffb4b4]" : "text-[#e3c77f]"
                }`}
              >
                <AlertTriangle size={14} /> {s.texto}
              </span>
            ))}
          </div>
        ) : null}

        {bajada ? (
          <span className="inline-flex items-center gap-2 text-[13px] text-[#ffb4b4] mt-2">
            <EyeOff size={14} /> Bajada: {b.moderada_motivo}
          </span>
        ) : null}
      </div>

      <div className="shrink-0">
        {bajada ? (
          <button
            type="button"
            onClick={restituir}
            disabled={busy}
            className="inline-flex items-center gap-2 label-tech text-[11px] uppercase tracking-widest px-5 py-3 border border-[#4c4546] text-[#cfc4c5] hover:border-[#e5e2e1] hover:text-[#e5e2e1] transition-colors disabled:opacity-50"
          >
            <RotateCcw size={14} /> Restituir
          </button>
        ) : (
          <button
            type="button"
            onClick={bajar}
            disabled={busy}
            className="inline-flex items-center gap-2 label-tech text-[11px] uppercase tracking-widest px-5 py-3 border border-[#4c4546] text-[#988e90] hover:border-[#ffb4b4] hover:text-[#ffb4b4] transition-colors disabled:opacity-50"
          >
            <EyeOff size={14} /> Bajar
          </button>
        )}
      </div>
    </div>
  );
}

export function PlataformaClient({
  resumen,
  busquedas,
  contrataciones,
  organizaciones,
}: {
  resumen: Resumen;
  busquedas: BusquedaPlataforma[];
  contrataciones: Contratacion[];
  organizaciones: OrgPlataforma[];
}) {
  // Lo que tiene señal y no está bajado va primero: en una lista de cien, que
  // las cinco que importan estén arriba.
  const conSenal = busquedas.filter(
    (b) => b.moderada_at == null && senalesDeRiesgo({ role: b.role, notas: b.notas, pago: b.pago }).length > 0,
  );
  const resto = busquedas.filter((b) => !conSenal.includes(b));

  return (
    <div className="flex flex-col gap-14">
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Dato n={resumen.organizaciones} label="Productoras" />
        <Dato n={resumen.personas} label="Personas" />
        <Dato n={resumen.proveedores} label="Proveedores" />
        <Dato n={resumen.busquedas_vivas} label="Búsquedas vivas" />
        <Dato n={resumen.postulaciones} label="Postulaciones" />
        <Dato n={resumen.contrataciones} label="Contrataciones" />
      </section>

      {conSenal.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="t-section text-[#ffb4b4] border-b border-[#4c4546]/60 pb-3">
            Mirá esto primero ({conSenal.length})
          </h3>
          <p className="text-[14px] text-[#988e90] leading-[1.6] max-w-[620px] mb-2">
            Ninguna está bloqueada, ya se publicaron. Son las que tienen alguna
            señal que conviene revisar.
          </p>
          {conSenal.map((b) => (
            <FilaBusqueda key={b.id} b={b} />
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h3 className="t-section text-[#e5e2e1] border-b border-[#4c4546]/60 pb-3">
          Contrataciones
        </h3>
        <p className="text-[14px] text-[#988e90] leading-[1.6] max-w-[620px] mb-2">
          El momento que importa no es cuando publican, es cuando contratan a
          alguien del pool. Ahí aparece la responsabilidad de la plataforma.
        </p>
        {contrataciones.length === 0 ? (
          <p className="text-[15px] text-[#cfc4c5] py-3">Todavía no hay contrataciones.</p>
        ) : (
          contrataciones.map((c) => (
            <div
              key={c.id}
              className="flex flex-col md:flex-row md:items-center justify-between gap-3 py-4 border-b border-[#1A1A1A]"
            >
              <div className="min-w-0">
                <span className="label-tech text-[11px] uppercase tracking-widest text-[#988e90]">
                  {c.organizacion} · {dia(c.responded_at)}
                </span>
                <h4 className="text-[16px] font-semibold text-[#e5e2e1]">
                  {c.persona || "Sin nombre"}
                </h4>
                <span className="text-[14px] text-[#cfc4c5]">
                  {c.role ?? "Sin rol"} · {c.gig_title ?? "Evento"}
                </span>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                {c.amount != null && Number(c.amount) > 0 ? (
                  <span className="text-[16px] font-semibold text-[#e5e2e1]">
                    {money(Number(c.amount))}
                  </span>
                ) : null}
                <span
                  className={`label-tech text-[11px] uppercase tracking-widest ${
                    c.pago_listo_at ? "text-[#7fae7f]" : "text-[#e3c77f]"
                  }`}
                >
                  {c.pago_listo_at ? "Pagado" : "A pagar"}
                </span>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="t-section text-[#e5e2e1] border-b border-[#4c4546]/60 pb-3">
          Todas las búsquedas ({resto.length})
        </h3>
        {resto.length === 0 ? (
          <p className="text-[15px] text-[#cfc4c5] py-3">No hay búsquedas publicadas.</p>
        ) : (
          resto.map((b) => <FilaBusqueda key={b.id} b={b} />)
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="t-section text-[#e5e2e1] border-b border-[#4c4546]/60 pb-3">
          Productoras
        </h3>
        {organizaciones.map((o) => (
          <div
            key={o.id}
            className="flex flex-col md:flex-row md:items-center justify-between gap-3 py-4 border-b border-[#1A1A1A]"
          >
            <div>
              <h4 className="text-[16px] font-semibold text-[#e5e2e1]">
                {o.name}
                {o.es_plataforma ? (
                  <span className="ml-3 label-tech text-[10px] uppercase tracking-widest text-[#b9c3ff] border border-[#4c4546] px-2 py-1">
                    plataforma
                  </span>
                ) : null}
                {!o.activa ? (
                  <span className="ml-3 label-tech text-[10px] uppercase tracking-widest text-[#ffb4b4]">
                    inactiva
                  </span>
                ) : null}
              </h4>
              <span className="text-[14px] text-[#cfc4c5]">
                {o.miembros} {o.miembros === 1 ? "miembro" : "miembros"} · {o.eventos}{" "}
                {o.eventos === 1 ? "evento" : "eventos"} · {o.busquedas}{" "}
                {o.busquedas === 1 ? "búsqueda" : "búsquedas"} · {o.contrataciones}{" "}
                {o.contrataciones === 1 ? "contratación" : "contrataciones"}
              </span>
            </div>
            <span className="label-tech text-[11px] uppercase tracking-widest text-[#988e90] shrink-0">
              desde {dia(o.created_at)}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
