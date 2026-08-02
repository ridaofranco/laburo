"use client";

/**
 * La lista de trabajos abiertos, con el botón de postularse.
 *
 * Regla de esta pantalla: la persona tiene que poder decidir SIN abrir nada.
 * Qué rol, cuándo, dónde y CUÁNTO SE PAGA, los cuatro en la misma tarjeta. El
 * monto especialmente: pedirle a alguien que levante la mano sin decirle cuánto
 * se paga es hacerle perder el tiempo a los dos, y es exactamente lo que hace
 * que la gente no vuelva.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MapPin, Check } from "lucide-react";
import { motion } from "motion/react";
import { postularme, despostularme, type TrabajoAbierto } from "./actions";
import { fmtFecha, fmtHora as fmtHoraTz } from "@/lib/dates";
import { money } from "@/lib/format";

function fmtDia(iso: string | null): string {
  return fmtFecha(iso, { day: "2-digit", month: "short", year: "numeric" }) ?? "Fecha a confirmar";
}
function fmtHora(iso: string | null): string | null {
  const h = fmtHoraTz(iso);
  return h ? `${h} hs` : null;
}
function mapsUrl(venue: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}`;
}

function Tarjeta({ t }: { t: TrabajoAbierto }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  // Optimista solo en el texto del botón: el estado real lo trae el refresh.
  const [postulado, setPostulado] = useState(t.ya_me_postule);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      const r = postulado
        ? await despostularme(t.opening_id)
        : await postularme(t.opening_id);
      if (r.ok) {
        setPostulado(!postulado);
        toast.success(postulado ? "Te bajaste de esta búsqueda" : "Te postulaste");
        router.refresh();
      } else {
        toast.error(r.error ?? "No se pudo.");
        router.refresh();
      }
    } catch {
      toast.error("No se pudo. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  // Si ya le mandaron la oferta, esta pantalla deja de ser el lugar: la
  // respuesta se da desde el panel, con el monto y las condiciones a la vista.
  const yaOfertada = t.mi_estado === "ofertada";

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 py-7 border-b border-[#1A1A1A]">
      <div className="flex flex-col gap-2 min-w-0">
        <span className="label-tech text-[12px] text-[#cfc4c5] uppercase tracking-widest">
          {fmtDia(t.gig_starts_at)}
          {fmtHora(t.gig_starts_at) ? ` · ${fmtHora(t.gig_starts_at)}` : ""}
        </span>
        <h3 className="text-[20px] font-semibold text-[#e5e2e1] break-words">
          {t.role}
        </h3>
        <span className="text-[15px] text-[#cfc4c5] break-words">
          {t.gig_title?.trim() || "Evento"}
          {t.gig_venue?.trim() ? ` • ${t.gig_venue}` : ""}
        </span>
        <div className="flex flex-wrap items-center gap-3 mt-1">
          {t.pago != null && Number(t.pago) > 0 ? (
            <span className="text-[18px] font-semibold text-[#e5e2e1]">
              {money(Number(t.pago))}
            </span>
          ) : (
            <span className="text-[15px] text-[#988e90]">Pago a confirmar</span>
          )}
          <span className="label-tech text-[11px] uppercase tracking-widest text-[#988e90]">
            {t.cupo === 1 ? "1 lugar" : `${t.cupo} lugares`}
          </span>
        </div>
        {t.notas?.trim() ? (
          <p className="text-[14px] text-[#988e90] leading-[1.6] mt-1 max-w-[560px]">
            {t.notas}
          </p>
        ) : null}
        {t.gig_venue?.trim() ? (
          <a
            href={mapsUrl(t.gig_venue)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 label-tech text-[11px] uppercase tracking-widest text-[#cfc4c5] hover:text-[#e5e2e1] transition-colors w-fit mt-1"
          >
            <MapPin size={14} /> Cómo llegar
          </a>
        ) : null}
      </div>

      <div className="shrink-0 flex flex-col items-start md:items-end gap-2">
        {yaOfertada ? (
          <>
            <span className="inline-flex items-center gap-2 label-tech text-[12px] uppercase tracking-widest text-[#7fae7f]">
              <Check size={16} /> Te mandaron la oferta
            </span>
            <a
              href="/panel-staff"
              className="label-tech text-[11px] uppercase tracking-widest text-[#cfc4c5] hover:text-[#e5e2e1] underline underline-offset-4 transition-colors"
            >
              Responder desde mi panel
            </a>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={toggle}
              disabled={busy}
              className={`label-tech text-[12px] uppercase tracking-widest px-8 py-4 border transition-colors duration-150 disabled:opacity-50 ${
                postulado
                  ? "border-[#4c4546] text-[#cfc4c5] hover:border-[#e5e2e1] hover:text-[#e5e2e1]"
                  : "border-[#e5e2e1] bg-[#e5e2e1] text-black hover:bg-transparent hover:text-[#e5e2e1]"
              }`}
            >
              {busy ? "Un segundo…" : postulado ? "Bajarme" : "Me postulo"}
            </button>
            {postulado ? (
              <span className="label-tech text-[11px] uppercase tracking-widest text-[#7fae7f]">
                Ya te postulaste
              </span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export function TrabajosClient({ trabajos }: { trabajos: TrabajoAbierto[] }) {
  if (trabajos.length === 0) {
    return (
      <div className="py-10">
        <p className="text-[18px] text-[#cfc4c5] leading-[1.6] max-w-[560px]">
          Ahora mismo no hay búsquedas abiertas. Cuando SOMOS DER publique una que
          vaya con lo tuyo, va a aparecer acá y te vas a poder postular sin
          esperar a que te escriban.
        </p>
        <p className="text-[15px] text-[#988e90] leading-[1.6] max-w-[560px] mt-4">
          Mientras tanto, tené tu perfil completo: es lo que miran cuando eligen.
        </p>
        <a
          href="/editar-perfil-staff"
          className="inline-block mt-6 label-tech text-[12px] uppercase tracking-widest text-[#cfc4c5] hover:text-[#e5e2e1] border-b border-[#4c4546] hover:border-[#e5e2e1] pb-1 transition-colors"
        >
          Completar mi perfil
        </a>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col"
    >
      {trabajos.map((t) => (
        <Tarjeta key={t.opening_id} t={t} />
      ))}
    </motion.div>
  );
}
