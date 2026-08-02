"use client";

/**
 * El buscador de proveedores. Misma lógica de tarjeta que /trabajos: que se
 * pueda decidir sin abrir nada. Qué hace, dónde trabaja y desde cuánto, los tres
 * en la misma tarjeta.
 *
 * Contactar abre WhatsApp o el mail (deep link, costo cero, el patrón que ya usa
 * toda la app) y ADEMÁS registra el contacto. Lo segundo es lo que le importa a
 * la plataforma: Franco, 2/8, "me enteraré cuando lo contacte".
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, BadgeCheck, MapPin, Check } from "lucide-react";
import { money } from "@/lib/format";
import { contactarProveedor, type Proveedor } from "./actions";

const input =
  "w-full bg-transparent border-0 border-b border-[#4c4546] focus:border-[#e5e2e1] outline-none text-[16px] text-[#e5e2e1] py-3 px-0 rounded-none transition-colors";

/** Deep link de WhatsApp, sin API ni costo (patrón de toda la app). */
function waUrl(telefono: string, mensaje: string): string {
  const num = telefono.replace(/[^0-9]/g, "");
  return `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`;
}

function Tarjeta({ p }: { p: Proveedor }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [contactado, setContactado] = useState(p.ya_contactado);

  const mensaje = `Hola ${p.display_name ?? ""}, te escribo desde LABURO por un evento.`;

  async function registrarYAbrir(url: string) {
    if (busy) return;
    setBusy(true);
    // Se abre PRIMERO, sincrónico con el click: si esperamos al servidor, el
    // navegador del celular bloquea la ventana por popup.
    window.open(url, "_blank", "noopener,noreferrer");
    try {
      const r = await contactarProveedor(p.profile_id, mensaje);
      if (r.ok) {
        setContactado(true);
        router.refresh();
      } else {
        toast.error(r.error ?? "Se abrió el contacto pero no se pudo registrar.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col md:flex-row md:items-start justify-between gap-5 py-7 border-b border-[#1A1A1A]">
      <div className="min-w-0 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-[20px] font-semibold text-[#e5e2e1]">
            {p.display_name ?? "Sin nombre"}
          </h3>
          {p.is_verified ? (
            <span className="inline-flex items-center gap-1 label-tech text-[10px] uppercase tracking-widest text-[#7fae7f]">
              <BadgeCheck size={14} /> verificado
            </span>
          ) : null}
          {p.es_favorito ? (
            <span className="label-tech text-[10px] uppercase tracking-widest text-[#e3c77f]">
              favorito
            </span>
          ) : null}
        </div>

        {p.headline?.trim() ? (
          <p className="text-[15px] text-[#cfc4c5]">{p.headline}</p>
        ) : null}

        {(p.ciudad || p.provincia) && (
          <span className="inline-flex items-center gap-2 text-[14px] text-[#988e90]">
            <MapPin size={14} />
            {[p.ciudad, p.provincia].filter(Boolean).join(", ")}
          </span>
        )}

        <div className="flex flex-col gap-2 mt-2">
          {p.servicios.map((s, i) => (
            <div key={i} className="border-l-2 border-[#4c4546] pl-4">
              <span className="label-tech text-[11px] uppercase tracking-widest text-[#988e90]">
                {s.categoria}
              </span>
              <p className="text-[16px] text-[#e5e2e1]">{s.titulo}</p>
              {s.descripcion?.trim() ? (
                <p className="text-[14px] text-[#988e90] max-w-[520px]">{s.descripcion}</p>
              ) : null}
              <span className="text-[14px] text-[#cfc4c5]">
                {s.precio_desde != null && Number(s.precio_desde) > 0
                  ? `Desde ${money(Number(s.precio_desde))}${s.unidad ? ` / ${s.unidad}` : ""}`
                  : "Precio a consultar"}
                {s.provincias?.length ? ` • ${s.provincias.join(", ")}` : ""}
              </span>
            </div>
          ))}
        </div>

        {p.nota_interna?.trim() ? (
          <p className="text-[13px] text-[#e3c77f] mt-2">Tu nota: {p.nota_interna}</p>
        ) : null}
      </div>

      <div className="shrink-0 flex flex-col items-start md:items-end gap-2">
        {contactado ? (
          <span className="inline-flex items-center gap-2 label-tech text-[11px] uppercase tracking-widest text-[#7fae7f]">
            <Check size={14} /> Ya lo contactaste
          </span>
        ) : null}
        {p.telefono?.trim() ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => registrarYAbrir(waUrl(p.telefono!, mensaje))}
            className="label-tech text-[12px] uppercase tracking-widest px-8 py-4 border border-[#e5e2e1] bg-[#e5e2e1] text-black hover:bg-transparent hover:text-[#e5e2e1] transition-colors disabled:opacity-50"
          >
            Escribir por WhatsApp
          </button>
        ) : null}
        {p.email?.trim() ? (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              registrarYAbrir(
                `mailto:${p.email}?subject=${encodeURIComponent("Consulta desde LABURO")}&body=${encodeURIComponent(mensaje)}`,
              )
            }
            className="label-tech text-[11px] uppercase tracking-widest px-6 py-3 border border-[#4c4546] text-[#cfc4c5] hover:border-[#e5e2e1] hover:text-[#e5e2e1] transition-colors disabled:opacity-50"
          >
            Escribir por mail
          </button>
        ) : null}
        {p.website?.trim() ? (
          <a
            href={p.website}
            target="_blank"
            rel="noopener noreferrer"
            className="label-tech text-[11px] uppercase tracking-widest text-[#988e90] hover:text-[#e5e2e1] transition-colors"
          >
            Ver su web
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function ProveedoresClient({
  proveedores,
  categorias,
  filtros,
}: {
  proveedores: Proveedor[];
  categorias: string[];
  filtros: { texto: string; categoria: string; provincia: string };
}) {
  const router = useRouter();
  const [texto, setTexto] = useState(filtros.texto);
  const [categoria, setCategoria] = useState(filtros.categoria);
  const [provincia, setProvincia] = useState(filtros.provincia);

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (texto.trim()) p.set("q", texto.trim());
    if (categoria) p.set("cat", categoria);
    if (provincia.trim()) p.set("prov", provincia.trim());
    router.push(`/proveedores${p.toString() ? `?${p}` : ""}`);
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={buscar} className="grid grid-cols-1 md:grid-cols-4 gap-5 items-end">
        <div className="md:col-span-2">
          <label className="label-tech text-[11px] uppercase tracking-widest text-[#cfc4c5] block mb-1" htmlFor="q">
            Qué necesitás
          </label>
          <input
            id="q"
            className={input}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="sonido, catering, fotos…"
          />
        </div>
        <div>
          <label className="label-tech text-[11px] uppercase tracking-widest text-[#cfc4c5] block mb-1" htmlFor="cat">
            Categoría
          </label>
          <select
            id="cat"
            className={`${input} appearance-none`}
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="label-tech text-[11px] uppercase tracking-widest text-[#cfc4c5] block mb-1" htmlFor="prov">
              Provincia
            </label>
            <input
              id="prov"
              className={input}
              value={provincia}
              onChange={(e) => setProvincia(e.target.value)}
              placeholder="Buenos Aires"
            />
          </div>
          <button
            type="submit"
            className="shrink-0 label-tech text-[12px] uppercase tracking-widest px-6 py-4 border border-[#e5e2e1] text-[#e5e2e1] hover:bg-[#e5e2e1] hover:text-black transition-colors inline-flex items-center gap-2"
          >
            <Search size={16} /> Buscar
          </button>
        </div>
      </form>

      {proveedores.length === 0 ? (
        <div className="py-8">
          <p className="text-[17px] text-[#cfc4c5] leading-[1.6] max-w-[600px]">
            No hay proveedores publicados que coincidan. El directorio recién
            arranca: se llena a medida que los proveedores se dan de alta y
            publican lo que ofrecen.
          </p>
        </div>
      ) : (
        <div className="flex flex-col">
          {proveedores.map((p) => (
            <Tarjeta key={p.profile_id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
