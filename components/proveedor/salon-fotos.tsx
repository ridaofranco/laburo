"use client";

/**
 * Las fotos del salón: subirlas, ordenarlas y borrarlas.
 *
 * Franco (6/8): *"a los salones le falta la parte de imágenes, que suban algunas
 * imágenes para promocionarlo"*. Es lo que más le faltaba al pool: un salón se
 * elige MIRANDO, y una ficha sin fotos es un aviso clasificado.
 *
 * ── LA FOTO NO PASA POR VERCEL ──────────────────────────────────────────────
 * El navegador le pide al servidor una URL firmada, sube DIRECTO a Supabase, y
 * recién ahí le manda al servidor el nombre del objeto. Por la Server Action
 * viajan unos cientos de bytes. Es la misma lección que costó el caso del CV:
 * una foto de celular pasa sola los 4,5 MB de techo del body.
 *
 * ── LA PRIMERA ES LA PORTADA, Y SE DICE ─────────────────────────────────────
 * Es la única que se ve en el listado. Si no se dijera, el salón subiría seis
 * fotos sin saber que la del baño quedó de portada.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, ArrowLeft, ImagePlus } from "lucide-react";
import type { Acceso } from "@/lib/proveedor-acceso";
import { pedirSubidaDeFoto, guardarFotosSalon } from "@/app/acceso-proveedor/[token]/actions";
import { urlDeFotoSalon } from "@/lib/salones";

const TOPE = 8;
/** El bucket corta en 5 MB. Se avisa ANTES de subir, no después del rebote. */
const MAX_BYTES = 5 * 1024 * 1024;

export function SalonFotos({
  acceso,
  fotosIniciales,
}: {
  acceso: Acceso;
  fotosIniciales: string[];
}) {
  const router = useRouter();
  const [fotos, setFotos] = useState<string[]>(fotosIniciales ?? []);
  const [subiendo, setSubiendo] = useState(false);
  const [pending, startTransition] = useTransition();

  function persistir(lista: string[], mensaje: string) {
    startTransition(async () => {
      const r = await guardarFotosSalon(acceso, lista);
      if (r.ok) {
        toast.success(mensaje);
        router.refresh();
        return;
      }
      toast.error(r.mensaje);
      // Se vuelve atrás en la pantalla: dejarla mostrando algo que la base
      // rechazó es peor que el error, porque el salón cree que quedó guardado.
      setFotos(fotosIniciales ?? []);
      if (r.terminal) router.refresh();
    });
  }

  async function onElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const elegidas = Array.from(e.target.files ?? []);
    // El input se limpia SIEMPRE y de entrada: si no, elegir el mismo archivo
    // dos veces seguidas no dispara el evento y parece que no anda.
    e.target.value = "";
    if (elegidas.length === 0 || subiendo) return;

    const lugar = TOPE - fotos.length;
    if (lugar <= 0) {
      toast.error(`Ya tenés ${TOPE} fotos. Borrá alguna para subir otra.`);
      return;
    }
    const aSubir = elegidas.slice(0, lugar);
    if (elegidas.length > lugar) {
      toast.error(`Entran ${lugar} más, así que subimos las primeras ${lugar}.`);
    }

    setSubiendo(true);
    const nuevas: string[] = [];
    try {
      for (const archivo of aSubir) {
        if (archivo.size > MAX_BYTES) {
          toast.error(`"${archivo.name}" pesa más de 5 MB y no entra.`);
          continue;
        }
        const ext = archivo.name.split(".").pop() ?? "jpg";
        const permiso = await pedirSubidaDeFoto(acceso, ext);
        if (!permiso.ok || !permiso.path || !permiso.token) {
          toast.error(permiso.mensaje ?? "No se pudo subir esa foto.");
          continue;
        }

        // Import dinámico: el cliente de Supabase solo se carga si de verdad se
        // sube una foto, no en cada apertura del panel.
        const { createClient } = await import("@/lib/supabase/client");
        const { error } = await createClient()
          .storage.from("venue-photos")
          .uploadToSignedUrl(permiso.path, permiso.token, archivo, {
            contentType: archivo.type || "image/jpeg",
          });

        if (error) {
          console.error("[salon-fotos] subida falló:", error.message);
          toast.error(`No se pudo subir "${archivo.name}".`);
          continue;
        }
        nuevas.push(permiso.path);
      }
    } finally {
      // try/finally: si algo tira en el medio, sin esto el botón queda
      // deshabilitado para siempre y la persona no puede ni reintentar.
      setSubiendo(false);
    }

    if (nuevas.length === 0) return;
    const lista = [...fotos, ...nuevas];
    setFotos(lista);
    persistir(lista, nuevas.length === 1 ? "Foto subida." : `${nuevas.length} fotos subidas.`);
  }

  function borrar(path: string) {
    const lista = fotos.filter((f) => f !== path);
    setFotos(lista);
    persistir(lista, "Foto borrada.");
  }

  function aPortada(path: string) {
    const lista = [path, ...fotos.filter((f) => f !== path)];
    setFotos(lista);
    persistir(lista, "Esa quedó de portada.");
  }

  const ocupado = subiendo || pending;

  return (
    <div className="flex flex-col gap-md">
      <p className="text-body text-fg-muted">
        Un salón se elige mirando. Subí hasta {TOPE} fotos: el salón vacío, armado
        para un evento, la entrada y el parque si tenés.{" "}
        <span className="text-fg">La primera es la portada</span>, y es la única
        que se ve en el listado.
      </p>

      {fotos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-sm">
          {fotos.map((f, i) => (
            <div key={f} className="relative aspect-[4/3] bg-surface-2 border border-border">
              {/* <img> y no next/image a propósito: son URLs públicas de
                  Supabase, cambian con cada subida y no vale la pena configurar
                  un dominio remoto para una grilla de miniaturas. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={urlDeFotoSalon(f)}
                alt={i === 0 ? "Portada del salón" : `Foto ${i + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {i === 0 ? (
                <span className="absolute top-2 left-2 label-tech text-[9px] uppercase tracking-[0.15em] bg-fg text-surface-0 px-2 py-1">
                  Portada
                </span>
              ) : null}
              <div className="absolute bottom-2 right-2 flex gap-1.5">
                {i !== 0 ? (
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => aPortada(f)}
                    title="Poner de portada"
                    aria-label="Poner de portada"
                    className="p-2 bg-surface-0/85 border border-border text-fg hover:text-accent transition-colors disabled:opacity-50"
                  >
                    <ArrowLeft size={14} aria-hidden="true" />
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => borrar(f)}
                  title="Borrar la foto"
                  aria-label="Borrar la foto"
                  className="p-2 bg-surface-0/85 border border-border text-fg hover:text-[#ff8a8a] transition-colors disabled:opacity-50"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-border border-dashed p-lg text-center">
          <p className="text-label text-fg-subtle">
            Todavía no subiste ninguna foto. Tu salón aparece solo con texto.
          </p>
        </div>
      )}

      <label
        className={`flex items-center justify-center gap-xs min-h-[48px] rounded-none border border-fg text-fg label-tech text-[13px] px-md transition-colors ${
          ocupado || fotos.length >= TOPE
            ? "opacity-50 pointer-events-none"
            : "cursor-pointer hover:bg-fg hover:text-surface-0"
        }`}
      >
        <ImagePlus size={16} aria-hidden="true" />
        {subiendo
          ? "Subiendo…"
          : fotos.length >= TOPE
            ? `Llegaste a las ${TOPE} fotos`
            : "Subir fotos"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          multiple
          className="hidden"
          disabled={ocupado || fotos.length >= TOPE}
          onChange={onElegir}
        />
      </label>

      <p className="text-label text-fg-subtle">
        Hasta 5 MB cada una. Si sacaste la foto con el teléfono, entra sin
        problema.
      </p>
    </div>
  );
}
