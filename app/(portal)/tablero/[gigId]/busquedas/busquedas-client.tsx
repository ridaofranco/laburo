"use client";

/**
 * Publicar búsquedas y mirar quién se postuló (lado productora, 0052/0053).
 *
 * El orden de la pantalla es el orden de la decisión: primero qué estoy
 * buscando, después quién levantó la mano. Y el botón de contratar NO está acá
 * a propósito: se contrata mandando la oferta desde el perfil de la persona, que
 * es donde se ve su CV y donde se escribe el monto. Duplicar eso acá sería tener
 * dos formas de contratar y que ninguna sea la buena.
 */

import { useState } from "react";
import { AvisoNoIntermediamos, AVISO_PUBLICAR, DECLARACION_PUBLICAR } from "@/components/aviso-no-intermediamos";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, Unlock, Send, X } from "lucide-react";
import { money } from "@/lib/format";
import {
  crearBusqueda,
  publicarBusqueda,
  cerrarBusqueda,
  marcarPostulacion,
} from "./actions";

export interface Busqueda {
  id: string;
  role: string;
  cupo: number;
  pago: number | null;
  notas: string | null;
  publicado_at: string | null;
  cerrado_at: string | null;
  postulados: number;
  sin_mirar: number;
}

export interface Postulacion {
  id: string;
  opening_id: string;
  staff_profile_id: string;
  estado: string;
  mensaje: string | null;
  nombre: string | null;
  apellido: string | null;
  ciudad: string | null;
  provincia: string | null;
  eventos_trabajados: number | null;
}

export const CONDICIONES = [
  { k: "horario", label: "Horario", ej: "18 a 02 h, llegar 17:30" },
  { k: "vestimenta", label: "Vestimenta", ej: "Todo negro, zapatos cerrados" },
  { k: "comida", label: "Comida", ej: "Incluye cena" },
  { k: "traslado", label: "Traslado", ej: "Combi desde Obelisco a las 16 h" },
  { k: "forma_pago", label: "Forma de pago", ej: "Transferencia" },
  { k: "plazo_pago", label: "Plazo de pago", ej: "A los 7 días del evento" },
] as const;

const input =
  "w-full bg-transparent border-0 border-b border-[#4c4546] focus:border-[#e5e2e1] outline-none text-[16px] text-[#e5e2e1] py-3 px-0 rounded-none transition-colors";
const label =
  "block mb-1 font-[family-name:var(--font-geist)] text-[11px] uppercase tracking-[0.1em] text-[#cfc4c5]";

function NuevaBusqueda({ gigId, pideDoc }: { gigId: string; pideDoc: boolean }) {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [cupo, setCupo] = useState("1");
  const [pago, setPago] = useState("");
  const [notas, setNotas] = useState("");
  const [declaro, setDeclaro] = useState(false);
  const [cond, setCond] = useState({ horario: "", vestimenta: "", comida: "", traslado: "", forma_pago: "", plazo_pago: "" });
  const [docTipo, setDocTipo] = useState<"CUIT" | "DNI">("CUIT");
  const [docNumero, setDocNumero] = useState("");
  const [busy, setBusy] = useState(false);

  async function guardar(publicar: boolean) {
    if (busy) return;
    if (!role.trim()) {
      toast.error("Escribí qué rol estás buscando.");
      return;
    }
    if (!declaro) {
      toast.error("Para publicar tenés que marcar la declaración jurada.");
      return;
    }
    setBusy(true);
    try {
      const r = await crearBusqueda(gigId, {
        role: role.trim(),
        cupo: Math.max(1, Number(cupo) || 1),
        pago: pago.trim() ? Number(pago) : null,
        notas: notas.trim() || null,
        publicar,
        declaracion: declaro,
        condiciones: cond,
        ...(pideDoc ? { docTipo, docNumero } : {}),
      });
      if (r.ok) {
        if ("aviso" in r && r.aviso) toast.warning(r.aviso, { duration: 12000 });
        else toast.success(publicar ? "Publicada, ya la ve el staff" : "Guardada como borrador");
        setRole("");
        setCupo("1");
        setPago("");
        setNotas("");
        setCond({ horario: "", vestimenta: "", comida: "", traslado: "", forma_pago: "", plazo_pago: "" });
        setDeclaro(false);
        router.refresh();
      } else {
        toast.error(r.error ?? "No se pudo.", { duration: 12000 });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border border-[#4c4546]/60 p-6 flex flex-col gap-5">
      <h3 className="label-tech text-[12px] uppercase tracking-[0.2em] text-[#c6c6c6]">
        Nueva búsqueda
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="md:col-span-1">
          <label className={label} htmlFor="b-role">Rol *</label>
          <input id="b-role" className={input} value={role} onChange={(e) => setRole(e.target.value)} placeholder="Mozo/a" />
        </div>
        <div>
          <label className={label} htmlFor="b-cupo">Cuántas personas</label>
          <input id="b-cupo" type="number" min={1} className={input} value={cupo} onChange={(e) => setCupo(e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="b-pago">Pago por persona</label>
          <input id="b-pago" type="number" min={0} className={input} value={pago} onChange={(e) => setPago(e.target.value)} placeholder="45000" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {CONDICIONES.map((c) => (
          <div key={c.k}>
            <label className={label} htmlFor={`b-${c.k}`}>{c.label}</label>
            <input
              id={`b-${c.k}`}
              className={input}
              value={cond[c.k]}
              onChange={(e) => setCond((v) => ({ ...v, [c.k]: e.target.value }))}
              placeholder={c.ej}
              maxLength={160}
            />
          </div>
        ))}
      </div>
      <div>
        <label className={label} htmlFor="b-notas">Otros requisitos (opcional)</label>
        <input id="b-notas" className={input} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Experiencia previa, idioma, qué llevar" />
      </div>
      {pideDoc ? (
        <div>
          <label className={label} htmlFor="b-doc">CUIT o DNI de quien publica *</label>
          <div className="flex gap-3">
            <select aria-label="Tipo de documento" className={`${input} shrink-0`} style={{ width: 96 }} value={docTipo} onChange={(e) => setDocTipo(e.target.value as "CUIT" | "DNI")}>
              <option value="CUIT" className="bg-black">CUIT</option>
              <option value="DNI" className="bg-black">DNI</option>
            </select>
            <input id="b-doc" className={`${input} flex-1 min-w-0`} inputMode="numeric" value={docNumero} onChange={(e) => setDocNumero(e.target.value)} placeholder={docTipo === "CUIT" ? "30-12345678-9" : "30123456"} />
          </div>
          <p className="text-[13px] text-[#988e90] mt-2">Se pide una sola vez. Solo lo ve la plataforma, nunca se muestra en público.</p>
        </div>
      ) : null}
      <p className="text-[13px] text-[#988e90] leading-[1.5]">
        Si no ponés el pago, al staff le va a decir &quot;a confirmar&quot;. Se
        postula menos gente cuando no sabe cuánto se paga.
      </p>
      <AvisoNoIntermediamos texto={AVISO_PUBLICAR} />
      {/* Casilla obligatoria y NO premarcada (TERMINOS-PROPUESTOS.md). */}
      <label htmlFor="b-declaro" className="flex items-start gap-3 cursor-pointer text-[13px] leading-[1.55] text-[#cfc4c5]">
        <input
          id="b-declaro"
          type="checkbox"
          checked={declaro}
          onChange={(e) => setDeclaro(e.target.checked)}
          className="mt-1 h-5 w-5 shrink-0 accent-[#e5e2e1]"
        />
        <span className="break-words">
          {DECLARACION_PUBLICAR}{" "}
          <a href="/terminos" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
            Ver términos
          </a>
        </span>
      </label>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => guardar(true)}
          disabled={busy}
          className="label-tech text-[12px] uppercase tracking-widest px-8 py-4 border border-[#e5e2e1] bg-[#e5e2e1] text-black hover:bg-transparent hover:text-[#e5e2e1] transition-colors disabled:opacity-50"
        >
          {busy ? "Un segundo…" : "Publicar ahora"}
        </button>
        <button
          type="button"
          onClick={() => guardar(false)}
          disabled={busy}
          className="label-tech text-[12px] uppercase tracking-widest px-8 py-4 border border-[#4c4546] text-[#cfc4c5] hover:border-[#e5e2e1] hover:text-[#e5e2e1] transition-colors disabled:opacity-50"
        >
          Guardar sin publicar
        </button>
      </div>
    </section>
  );
}

function Postulado({
  gigId,
  busqueda,
  p,
}: {
  gigId: string;
  /** La búsqueda a la que se postuló: su rol y su pago van precargados en la oferta. */
  busqueda: Busqueda;
  p: Postulacion;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const nombre = [p.nombre, p.apellido].filter(Boolean).join(" ").trim() || "Sin nombre";

  async function marcar(estado: string) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await marcarPostulacion(gigId, p.id, estado);
      if (r.ok) router.refresh();
      else toast.error(r.error ?? "No se pudo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 border-b border-[#1A1A1A]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/staff/${p.staff_profile_id}`}
            className="text-[16px] font-semibold text-[#e5e2e1] hover:underline underline-offset-4"
          >
            {nombre}
          </Link>
          {p.estado !== "postulada" ? (
            <span className="label-tech text-[10px] uppercase tracking-widest text-[#988e90] border border-[#4c4546] px-2 py-1">
              {p.estado}
            </span>
          ) : null}
        </div>
        <span className="text-[14px] text-[#cfc4c5]">
          {[p.ciudad, p.provincia].filter(Boolean).join(", ") || "Sin ubicación"}
          {p.eventos_trabajados ? ` • ${p.eventos_trabajados} eventos` : ""}
        </span>
        {p.mensaje?.trim() ? (
          <p className="text-[14px] text-[#988e90] mt-1 max-w-[520px]">{p.mensaje}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <Link
          href={`/staff/${p.staff_profile_id}/oferta?${new URLSearchParams({
            gig: gigId,
            rol: busqueda.role,
            ...(busqueda.pago != null ? { monto: String(busqueda.pago) } : {}),
          }).toString()}`}
          onClick={() => marcar("ofertada")}
          className="inline-flex items-center gap-2 label-tech text-[11px] uppercase tracking-widest px-5 py-3 border border-[#e5e2e1] text-[#e5e2e1] hover:bg-[#e5e2e1] hover:text-black transition-colors"
        >
          <Send size={14} /> Mandar oferta
        </Link>
        <button
          type="button"
          onClick={() => marcar(p.estado === "descartada" ? "vista" : "descartada")}
          disabled={busy}
          className="inline-flex items-center gap-2 label-tech text-[11px] uppercase tracking-widest px-4 py-3 border border-[#4c4546] text-[#988e90] hover:border-[#e5e2e1] hover:text-[#e5e2e1] transition-colors disabled:opacity-50"
        >
          <X size={14} /> {p.estado === "descartada" ? "Reactivar" : "Descartar"}
        </button>
      </div>
    </div>
  );
}

export function BusquedasClient({
  gigId,
  busquedas,
  postulaciones,
  errorCarga = false,
  pideDoc = false,
}: {
  gigId: string;
  busquedas: Busqueda[];
  postulaciones: Postulacion[];
  /** La lectura falló: no decir «no publicaste ninguna» cuando no lo sabemos. */
  errorCarga?: boolean;
  /** La organización todavía no cargó CUIT o DNI (las de antes de la 0107). */
  pideDoc?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function accion(fn: () => Promise<{ ok: boolean; error?: string }>, id: string) {
    if (busy) return;
    setBusy(id);
    try {
      const r = await fn();
      if (r.ok) router.refresh();
      else toast.error(r.error ?? "No se pudo.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <NuevaBusqueda gigId={gigId} pideDoc={pideDoc} />

      {errorCarga ? (
        <p role="alert" className="border border-[#5c2b2b] px-5 py-4 text-[16px] text-[#e5e2e1] leading-[1.6] max-w-[600px]">
          No pudimos cargar las búsquedas de este evento. Recargá la página y, si
          sigue igual, avisanos por WhatsApp.
        </p>
      ) : busquedas.length === 0 ? (
        <p className="text-[16px] text-[#cfc4c5] leading-[1.6] max-w-[600px]">
          Todavía no publicaste ninguna búsqueda para este evento. Cuando
          publiques una, le aparece a todo el pool de staff y se pueden postular
          solos, sin que tengas que buscar uno por uno.
        </p>
      ) : (
        busquedas.map((b) => {
          const suyas = postulaciones.filter((p) => p.opening_id === b.id);
          const publicada = b.publicado_at != null && b.cerrado_at == null;
          return (
            <section key={b.id} className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#4c4546]/60 pb-4">
                <div>
                  <h3 className="t-section text-[#e5e2e1]">{b.role}</h3>
                  <span className="text-[15px] text-[#cfc4c5]">
                    {b.cupo === 1 ? "1 lugar" : `${b.cupo} lugares`}
                    {b.pago != null && Number(b.pago) > 0 ? ` • ${money(Number(b.pago))}` : " • pago a confirmar"}
                    {" • "}
                    {b.postulados === 0
                      ? "sin postulados"
                      : b.postulados === 1
                        ? "1 postulado"
                        : `${b.postulados} postulados`}
                  </span>
                  {b.notas?.trim() ? (
                    <p className="text-[14px] text-[#988e90] mt-1">{b.notas}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={busy === b.id}
                    onClick={() => accion(() => publicarBusqueda(gigId, b.id, !publicada), b.id)}
                    className="inline-flex items-center gap-2 label-tech text-[11px] uppercase tracking-widest px-5 py-3 border border-[#4c4546] text-[#cfc4c5] hover:border-[#e5e2e1] hover:text-[#e5e2e1] transition-colors disabled:opacity-50"
                  >
                    {publicada ? <><EyeOff size={14} /> Despublicar</> : <><Eye size={14} /> Publicar</>}
                  </button>
                  {b.publicado_at ? (
                    <button
                      type="button"
                      disabled={busy === b.id}
                      onClick={() => accion(() => cerrarBusqueda(gigId, b.id, b.cerrado_at == null), b.id)}
                      className="inline-flex items-center gap-2 label-tech text-[11px] uppercase tracking-widest px-5 py-3 border border-[#4c4546] text-[#988e90] hover:border-[#e5e2e1] hover:text-[#e5e2e1] transition-colors disabled:opacity-50"
                    >
                      {b.cerrado_at ? <><Unlock size={14} /> Reabrir</> : <><Lock size={14} /> Cerrar</>}
                    </button>
                  ) : null}
                </div>
              </div>

              {/* El estado real, en una línea, sin que haya que deducirlo. */}
              <p className="label-tech text-[11px] uppercase tracking-widest text-[#988e90] -mt-2">
                {b.cerrado_at
                  ? "Cerrada, ya no se puede postular nadie"
                  : b.publicado_at
                    ? "Publicada, la ve todo el pool"
                    : "Borrador, no la ve nadie"}
              </p>

              {suyas.length === 0 ? (
                <p className="text-[15px] text-[#988e90] py-2">
                  {b.publicado_at
                    ? "Todavía no se postuló nadie."
                    : "Publicala para que el staff la pueda ver."}
                </p>
              ) : (
                <div className="flex flex-col">
                  {suyas.map((p) => (
                    <Postulado key={p.id} gigId={gigId} busqueda={b} p={p} />
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
