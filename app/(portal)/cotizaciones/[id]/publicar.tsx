"use client";

/**
 * Publicar el pedido: los dos interruptores que pidió Franco.
 *
 * ⚠️ SON DOS COSAS DISTINTAS Y SE DECIDEN POR SEPARADO:
 *   1. Pública o privada → quién puede VER el pedido.
 *   2. Mostrar el nombre → si la página dice "FIEBRE DISCO está pidiendo
 *      presupuesto" o "Una productora está pidiendo presupuesto".
 * El segundo existe porque el proveedor que sabe de quién es el evento cotiza
 * distinto, y a veces conviene pedir precio sin que se sepa quién pide.
 */

import { useState, useTransition } from "react";
import { Globe, Lock, Copy, Check } from "lucide-react";
import { cambiarVisibilidad } from "../licitacion-actions";

export function Publicar({
  requestId,
  inicial,
  origen,
}: {
  requestId: string;
  inicial: { publica: boolean; mostrar_productora: boolean; slug: string | null; puede_editar: boolean };
  /** El dominio, para armar el link visible sin adivinarlo en el cliente. */
  origen: string;
}) {
  const [publica, setPublica] = useState(inicial.publica);
  const [conNombre, setConNombre] = useState(inicial.mostrar_productora);
  const [slug, setSlug] = useState(inicial.slug);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [pendiente, startTransition] = useTransition();

  const link = slug ? `${origen}/licitaciones/${slug}` : null;

  function guardar(nuevaPublica: boolean, nuevoNombre: boolean) {
    setError(null);
    startTransition(async () => {
      const r = await cambiarVisibilidad(requestId, nuevaPublica, nuevoNombre);
      if (r.ok) {
        setPublica(r.publica);
        setSlug(r.slug);
      } else {
        setError(r.error);
        // Volver atrás en la pantalla: si la base no cambió, el interruptor
        // tampoco puede quedar cambiado.
        setPublica(publica);
        setConNombre(conNombre);
      }
    });
  }

  if (!inicial.puede_editar) return null;

  return (
    <section className="border border-[#1A1A1A] bg-[#0A0A0A] p-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        {publica ? <Globe size={20} className="text-[#0047FF]" /> : <Lock size={20} className="text-[#8A8A8A]" />}
        <h2 className="text-[18px] text-[#e5e2e1]">
          {publica ? "Licitación pública" : "Pedido privado"}
        </h2>
      </div>

      <p className="text-[15px] leading-[1.7] text-[#8A8A8A]">
        {publica
          ? "Cualquier proveedor puede ver este pedido y pedir el link para cotizar. Los que ya invitaste siguen igual."
          : "Solo cotizan los proveedores que invitaste. Nadie más lo ve."}
      </p>

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={publica}
            disabled={pendiente}
            onChange={(e) => {
              setPublica(e.target.checked);
              guardar(e.target.checked, conNombre);
            }}
            className="w-4 h-4 accent-[#0047FF]"
          />
          <span className="text-[15px] text-[#e5e2e1]">Publicar esta licitación</span>
        </label>

        {publica ? (
          <label className="flex items-center gap-3 cursor-pointer pl-7">
            <input
              type="checkbox"
              checked={conNombre}
              disabled={pendiente}
              onChange={(e) => {
                setConNombre(e.target.checked);
                guardar(publica, e.target.checked);
              }}
              className="w-4 h-4 accent-[#0047FF]"
            />
            <span className="text-[15px] text-[#cfc4c5]">
              Mostrar quién pide
              <span className="block text-[13px] text-[#8A8A8A]">
                {conNombre
                  ? "La página dice el nombre de tu productora."
                  : 'La página dice "Una productora".'}
              </span>
            </span>
          </label>
        ) : null}
      </div>

      {publica && link ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-[#1A1A1A] pt-4">
          <code className="text-[13px] text-[#cfc4c5] break-all flex-1 min-w-0">{link}</code>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2500);
              } catch {
                /* Sin permiso de portapapeles el link igual está a la vista. */
              }
            }}
            className="min-h-[40px] px-4 border border-[#2a2a2a] text-[13px] text-[#cfc4c5] hover:border-[#0047FF] hover:text-[#e5e2e1] transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            {copiado ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar link</>}
          </button>
        </div>
      ) : null}

      {error ? <p role="alert" className="text-[14px] text-[#ff8a8a]">{error}</p> : null}
    </section>
  );
}
