"use client";

import { useState, useTransition } from "react";
import { resolverDenuncia, type DenunciaPlataforma } from "../actions";

const MOTIVOS: Record<string, string> = {
  pide_plata: "Piden plata para trabajar o postularse",
  discrimina: "Discrimina",
  falsa: "Parece falsa o engañosa",
  ilegal: "Trabajo ilegal, en negro o con menores",
  otro: "Otro motivo",
};

const TIPOS: Record<string, string> = {
  busqueda: "Búsqueda abierta",
  oferta: "Oferta por link",
  perfil: "Perfil",
};

function fecha(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hourCycle: "h23",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Fila({ d }: { d: DenunciaPlataforma }) {
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const sePuedeBajar = !!(d.opening_id || d.offer_id);

  function resolver(estado: "baja" | "descartada") {
    setError(null);
    start(async () => {
      const r = await resolverDenuncia(d.id, estado, nota);
      if (r.ok) setListo(estado === "baja" ? "Dada de baja" : "Descartada");
      else setError(r.error ?? "No se pudo.");
    });
  }

  return (
    <li className={`border p-5 flex flex-col gap-3 min-w-0 ${d.urgente ? "border-[#ff4d4d]" : "border-[#4c4546]"}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {d.urgente && (
          <span className="label-tech text-[11px] tracking-[0.2em] text-[#ff4d4d]">URGENTE</span>
        )}
        <span className="label-tech text-[11px] tracking-[0.2em] text-[#c6c6c6]">{TIPOS[d.tipo] ?? d.tipo}</span>
        <span className="text-[13px] text-[#8a8a8a]">{fecha(d.created_at)}</span>
      </div>
      <p className="text-[17px] text-[#e5e2e1] break-words">{MOTIVOS[d.motivo] ?? d.motivo}</p>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-[14px] text-[#cfc4c5]">
        {d.rol && <div className="min-w-0 break-words"><dt className="inline text-[#8a8a8a]">Rol: </dt><dd className="inline">{d.rol}</dd></div>}
        {d.evento && <div className="min-w-0 break-words"><dt className="inline text-[#8a8a8a]">Evento: </dt><dd className="inline">{d.evento}</dd></div>}
        {(d.organizacion || d.quien_publica) && (
          <div className="min-w-0 break-words"><dt className="inline text-[#8a8a8a]">Publica: </dt><dd className="inline">{d.organizacion ?? d.quien_publica}</dd></div>
        )}
        {d.denunciante && <div className="min-w-0 break-words"><dt className="inline text-[#8a8a8a]">Denuncia: </dt><dd className="inline">{d.denunciante}</dd></div>}
        {d.busqueda_moderada_at && <div className="text-[#ffb84d]">La búsqueda ya está bajada.</div>}
        {d.oferta_estado && <div><dt className="inline text-[#8a8a8a]">Estado de la oferta: </dt><dd className="inline">{d.oferta_estado}</dd></div>}
      </dl>
      {d.detalle && <p className="text-[14px] text-[#e5e2e1] leading-[1.6] whitespace-pre-wrap break-words">«{d.detalle}»</p>}

      {listo ? (
        <p className="text-[14px] text-[#7dd87d]">{listo}.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Nota (opcional): por qué la bajás o la descartás"
            maxLength={300}
            className="w-full bg-transparent border border-[#4c4546] px-3 py-2 text-[14px] text-[#e5e2e1] placeholder:text-[#8a8a8a]"
          />
          <div className="flex flex-wrap gap-3">
            {sePuedeBajar && (
              <button
                type="button"
                disabled={pending}
                onClick={() => resolver("baja")}
                className="label-tech text-[12px] tracking-[0.15em] px-4 py-3 bg-[#ff4d4d] text-black disabled:opacity-50"
              >
                Dar de baja la oferta
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => resolver("descartada")}
              className="label-tech text-[12px] tracking-[0.15em] px-4 py-3 border border-[#4c4546] text-[#e5e2e1] disabled:opacity-50"
            >
              Descartar denuncia
            </button>
          </div>
          {error && <p className="text-[14px] text-[#ff4d4d]">{error}</p>}
        </div>
      )}
    </li>
  );
}

export function DenunciasClient({ denuncias }: { denuncias: DenunciaPlataforma[] }) {
  if (denuncias.length === 0) {
    return <p className="text-[15px] text-[#cfc4c5]">No hay denuncias pendientes.</p>;
  }
  return (
    <ul className="flex flex-col gap-4">
      {denuncias.map((d) => (
        <Fila key={d.id} d={d} />
      ))}
    </ul>
  );
}
