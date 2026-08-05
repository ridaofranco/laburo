"use client";

/**
 * El control de la alta abierta de proveedores.
 *
 * El proveedor se publica solo y al toque, sin que nadie apruebe (decisión de
 * Franco, 3/8). Esta pantalla es la contracara: ver qué se publicó y poder
 * sacarlo. Ya pasó una vez que el único proveedor del directorio tenía una
 * obscenidad en la bio, así que acá la bio se muestra ENTERA y sin recortar: es
 * justo el campo donde aparece lo que hay que bajar.
 *
 * Bajar pide motivo a propósito, igual que las búsquedas: en dos meses nadie se
 * acuerda por qué, ni sabe qué contestarle al proveedor que pregunta.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { moderarProveedor, type ProveedorPlataforma } from "../actions";

function fecha(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function ProveedoresClient({ proveedores }: { proveedores: ProveedorPlataforma[] }) {
  const [pendiente, startTransition] = useTransition();
  const [abierto, setAbierto] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  function bajar(id: string) {
    setError(null);
    startTransition(async () => {
      const r = await moderarProveedor(id, true, motivo);
      if (r.ok) {
        setAbierto(null);
        setMotivo("");
      } else setError(r.error ?? "No se pudo.");
    });
  }

  function subir(id: string) {
    setError(null);
    startTransition(async () => {
      const r = await moderarProveedor(id, false);
      if (!r.ok) setError(r.error ?? "No se pudo.");
    });
  }

  if (proveedores.length === 0) {
    return (
      <p className="text-[16px] text-[#cfc4c5] leading-[1.6]">
        Todavía no se anotó ningún proveedor. Cuando alguien se registre desde
        /registrar-proveedor te va a llegar un aviso y va a aparecer acá.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {error ? (
        <p role="alert" className="text-[14px] text-[#ff8a8a]">
          {error}
        </p>
      ) : null}

      {proveedores.map((p) => {
        const bajado = !!p.moderado_at;
        return (
          <div
            key={p.id}
            className={`border p-5 md:p-7 flex flex-col gap-4 ${
              bajado ? "border-[#4a2a2a] bg-[#150e0e]" : "border-[#262626] bg-[#181818]"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[18px] font-semibold text-[#e5e2e1] break-words">
                  {p.nombre}
                </p>
                <p className="label-tech text-[11px] tracking-[0.18em] text-[#8a8a8a] mt-2 break-words">
                  {p.email} · {p.servicios} servicio{p.servicios === 1 ? "" : "s"} ·{" "}
                  {p.consultas} consulta{p.consultas === 1 ? "" : "s"} · alta {fecha(p.created_at)}
                </p>
              </div>
              <span
                className={`label-tech text-[10px] tracking-[0.2em] px-3 py-2 whitespace-nowrap ${
                  bajado
                    ? "bg-[#3a1c1c] text-[#ff9c9c]"
                    : p.is_public
                      ? "bg-[#0047ff] text-white"
                      : "bg-[#2a2a2a] text-[#a5a5a5]"
                }`}
              >
                {bajado ? "Bajado por vos" : p.is_public ? "En la vidriera" : "Despublicado"}
              </span>
            </div>

            {p.headline ? (
              <p className="text-[15px] text-[#cfc4c5] leading-[1.6]">{p.headline}</p>
            ) : null}

            {/* La bio va COMPLETA: es el campo donde aparece lo que hay que bajar. */}
            {p.bio ? (
              <p className="text-[14px] text-[#a5a5a5] leading-[1.6] whitespace-pre-wrap break-words border-l-2 border-[#333] pl-4">
                {p.bio}
              </p>
            ) : null}

            {bajado && p.moderado_motivo ? (
              <p className="text-[13px] text-[#ff9c9c] leading-[1.6]">
                Lo bajaste el {fecha(p.moderado_at)}: {p.moderado_motivo}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-4 mt-1">
              {p.slug ? (
                <Link
                  href={`/servicios/${p.slug}`}
                  target="_blank"
                  className="label-tech text-[11px] tracking-[0.2em] text-[#cfc4c5] hover:text-[#0047ff] transition-colors"
                >
                  Ver su ficha
                </Link>
              ) : null}

              {bajado ? (
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => subir(p.id)}
                  className="label-tech text-[11px] tracking-[0.2em] text-[#8fd6a0] hover:text-[#b6ebc2] transition-colors cursor-pointer disabled:opacity-50"
                >
                  Volver a publicarlo
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => {
                    setAbierto(abierto === p.id ? null : p.id);
                    setMotivo("");
                    setError(null);
                  }}
                  className="label-tech text-[11px] tracking-[0.2em] text-[#ff9c9c] hover:text-[#ffc0c0] transition-colors cursor-pointer disabled:opacity-50"
                >
                  Bajarlo del directorio
                </button>
              )}
            </div>

            {abierto === p.id ? (
              <div className="flex flex-col sm:flex-row gap-3 mt-1">
                <input
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Por qué lo bajás"
                  className="flex-1 bg-transparent border-0 border-b border-[#4c4546] focus:border-[#e5e2e1] outline-none text-[15px] text-[#e5e2e1] py-3 rounded-none transition-colors"
                />
                <button
                  type="button"
                  disabled={pendiente || !motivo.trim()}
                  onClick={() => bajar(p.id)}
                  className="label-tech text-[11px] tracking-[0.2em] border border-[#ff9c9c] text-[#ff9c9c] px-6 py-3 hover:bg-[#ff9c9c] hover:text-black transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap"
                >
                  {pendiente ? "Un segundo…" : "Confirmar"}
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
