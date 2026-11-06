"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { asegurar, type PersonaSeguro, type SeguroGuardado } from "./actions";
import { fmtFecha } from "@/lib/dates";

const input =
  "w-full bg-transparent border-0 border-b border-[#4c4546] focus:border-[#e5e2e1] outline-none text-[16px] text-[#e5e2e1] py-2 px-0 rounded-none";
const label = "block mb-1 text-[11px] uppercase tracking-[0.1em] text-[#cfc4c5]";

type Fila = {
  staff_profile_id: string;
  elegido: boolean;
  nombre: string;
  apellido: string;
  documento_tipo: string;
  documento: string;
  nacimiento: string;
  genero: string;
  rol: string;
};

function completa(f: Fila) {
  return Boolean(f.nombre.trim() && f.apellido.trim() && f.documento.replace(/\D/g, "") && /^\d{4}-\d{2}-\d{2}$/.test(f.nacimiento) && (f.genero === "f" || f.genero === "m"));
}

const ESTADO: Record<string, string> = { open: "Falta pagar", close: "Vencido", cancel: "Anulado" };

export function SeguroClient({
  gigId,
  personas,
  seguros,
  coberturas,
  errorCotizar,
  vigencia,
  activo,
}: {
  gigId: string;
  personas: PersonaSeguro[];
  seguros: SeguroGuardado[];
  coberturas: { id: number; nombre: string }[];
  errorCotizar: string | null;
  vigencia: { desde: string; hasta: string } | null;
  activo: boolean;
}) {
  const router = useRouter();
  const yaAseguradas = useMemo(
    () => new Set(seguros.filter((s) => s.estado !== "cancel").flatMap((s) => s.personas)),
    [seguros],
  );
  const [filas, setFilas] = useState<Fila[]>(() =>
    personas.map((p) => ({
      staff_profile_id: p.staff_profile_id,
      elegido: !yaAseguradas.has(p.staff_profile_id),
      nombre: p.nombre ?? "",
      apellido: p.apellido ?? "",
      documento_tipo: p.documento_tipo ?? "DNI",
      documento: p.documento ?? "",
      nacimiento: p.fecha_nacimiento ?? "",
      genero: p.genero ?? "",
      rol: p.rol ?? "",
    })),
  );
  const [cobertura, setCobertura] = useState<number | "">(coberturas.find((c) => /10\.000\.000/.test(c.nombre))?.id ?? coberturas[0]?.id ?? "");
  const [conNoRep, setConNoRep] = useState(false);
  const [benNombre, setBenNombre] = useState("");
  const [benCuit, setBenCuit] = useState("");
  const [busy, setBusy] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);

  const elegidas = filas.filter((f) => f.elegido);
  const set = (id: string, cambio: Partial<Fila>) => setFilas((fs) => fs.map((f) => (f.staff_profile_id === id ? { ...f, ...cambio } : f)));

  async function onAsegurar() {
    if (busy) return;
    const falta = elegidas.find((f) => !completa(f));
    if (falta) {
      setAbierta(falta.staff_profile_id);
      toast.error(`Completá los datos de ${falta.nombre || "esa persona"}: los pide la aseguradora.`);
      return;
    }
    if (!cobertura) return toast.error("Elegí la suma asegurada.");
    setBusy(true);
    try {
      const r = await asegurar(gigId, {
        coverageId: Number(cobertura),
        coberturaNombre: coberturas.find((c) => c.id === cobertura)?.nombre ?? "",
        personas: elegidas.map((f) => ({
          staff_profile_id: f.staff_profile_id,
          nombre: f.nombre,
          apellido: f.apellido,
          documento_tipo: f.documento_tipo,
          documento: f.documento,
          nacimiento: f.nacimiento,
          genero: f.genero as "f" | "m",
        })),
        beneficiario: conNoRep ? { nombre: benNombre, cuit: benCuit } : null,
      });
      if (!r.ok) {
        toast.error(r.error, { duration: 12000 });
        return;
      }
      toast.success("Listo. Te llevamos a MercadoPago para pagarle a MeCubro.");
      router.refresh();
      window.location.href = r.linkPago;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      {seguros.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="label-tech text-[12px] uppercase tracking-[0.2em] text-[#c6c6c6]">Seguros de este evento</h2>
          {seguros.map((s) => (
            <div key={s.id} className="border border-[#4c4546]/60 p-4 flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[15px] text-[#e5e2e1] font-semibold">
                  {s.personas.length === 1 ? "1 persona" : `${s.personas.length} personas`} · {s.cobertura ?? "Accidentes personales"}
                </span>
                <span className={`label-tech text-[11px] uppercase tracking-widest ${s.pagado_at ? "text-[#9be29b]" : "text-[#f5a623]"}`}>
                  {s.pagado_at ? "Pagado y emitido" : (ESTADO[s.estado] ?? s.estado)}
                </span>
              </div>
              <span className="text-[13px] text-[#988e90]">
                {fmtFecha(s.vigencia_desde)}
                {s.vigencia_hasta !== s.vigencia_desde ? ` al ${fmtFecha(s.vigencia_hasta)}` : ""}
                {s.total ? ` · ${new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(s.total))}` : ""}
                {s.beneficiario_nombre ? ` · No repetición: ${s.beneficiario_nombre}` : ""}
                {s.codigo ? ` · Código ${s.codigo}` : ""}
              </span>
              <div className="flex flex-wrap gap-4">
                {s.pagado_at ? (
                  <a href={`/tablero/${gigId}/seguro/certificado/${s.id}`} target="_blank" rel="noopener" className="label-tech text-[12px] text-[#9be29b] underline">
                    Ver certificado (PDF)
                  </a>
                ) : s.link_pago && s.estado === "open" ? (
                  <a href={s.link_pago} className="label-tech text-[12px] text-[#b9c3ff] underline">
                    Pagar a MeCubro
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-5">
        <h2 className="label-tech text-[12px] uppercase tracking-[0.2em] text-[#c6c6c6]">Personas para asegurar</h2>
        {!activo ? (
          <p className="text-[14px] text-[#988e90]">El seguro con MeCubro se está activando. Muy pronto vas a poder asegurar desde acá.</p>
        ) : personas.length === 0 ? (
          <p className="text-[14px] text-[#988e90]">Todavía nadie aceptó una oferta de este evento. Cuando acepten, aparecen acá para asegurar.</p>
        ) : !vigencia ? (
          <p className="text-[14px] text-[#988e90]">El evento no tiene fecha. Cargala en «Editar» para poder asegurar.</p>
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-[#1A1A1A] border-y border-[#1A1A1A]">
              {filas.map((f) => {
                const ya = yaAseguradas.has(f.staff_profile_id);
                const ok = completa(f);
                const abiertaEsta = abierta === f.staff_profile_id;
                return (
                  <li key={f.staff_profile_id} className="py-3 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        aria-label={`Asegurar a ${f.nombre}`}
                        className="w-5 h-5 accent-[#9be29b] shrink-0"
                        checked={f.elegido}
                        onChange={(e) => set(f.staff_profile_id, { elegido: e.target.checked })}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] text-[#e5e2e1] truncate">
                          {f.nombre} {f.apellido}
                        </p>
                        <p className="text-[12px] text-[#988e90]">
                          {f.rol || "Staff"}
                          {ya ? " · ya asegurada" : ""}
                          {!ok ? " · faltan datos" : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAbierta(abiertaEsta ? null : f.staff_profile_id)}
                        className={`label-tech text-[11px] underline shrink-0 ${ok ? "text-[#988e90]" : "text-[#f5a623]"}`}
                      >
                        {abiertaEsta ? "Cerrar" : ok ? "Ver datos" : "Completar"}
                      </button>
                    </div>
                    {abiertaEsta ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-8">
                        <div>
                          <label className={label} htmlFor={`n-${f.staff_profile_id}`}>Nombre</label>
                          <input id={`n-${f.staff_profile_id}`} className={input} value={f.nombre} onChange={(e) => set(f.staff_profile_id, { nombre: e.target.value })} />
                        </div>
                        <div>
                          <label className={label} htmlFor={`a-${f.staff_profile_id}`}>Apellido</label>
                          <input id={`a-${f.staff_profile_id}`} className={input} value={f.apellido} onChange={(e) => set(f.staff_profile_id, { apellido: e.target.value })} />
                        </div>
                        <div className="flex gap-3">
                          <select aria-label="Tipo de documento" className={`${input} shrink-0`} style={{ width: 110 }} value={f.documento_tipo} onChange={(e) => set(f.staff_profile_id, { documento_tipo: e.target.value })}>
                            <option value="DNI" className="bg-black">DNI</option>
                            <option value="PASAPORTE" className="bg-black">Pasaporte</option>
                            <option value="OTRO" className="bg-black">Otro</option>
                          </select>
                          <input aria-label="Número de documento" inputMode="numeric" className={`${input} flex-1 min-w-0`} value={f.documento} onChange={(e) => set(f.staff_profile_id, { documento: e.target.value })} placeholder="Número" />
                        </div>
                        <div>
                          <label className={label} htmlFor={`f-${f.staff_profile_id}`}>Nacimiento</label>
                          <input id={`f-${f.staff_profile_id}`} type="date" className={input} value={f.nacimiento} onChange={(e) => set(f.staff_profile_id, { nacimiento: e.target.value })} />
                        </div>
                        <div>
                          <span className={label}>Género (lo pide la aseguradora)</span>
                          <div className="flex gap-5 py-2 text-[15px] text-[#e5e2e1]">
                            {[["f", "Femenino"], ["m", "Masculino"]].map(([v, t]) => (
                              <label key={v} className="flex items-center gap-2">
                                <input type="radio" name={`g-${f.staff_profile_id}`} checked={f.genero === v} onChange={() => set(f.staff_profile_id, { genero: v })} />
                                {t}
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <div>
              <label className={label} htmlFor="cobertura">Suma asegurada</label>
              {coberturas.length ? (
                <select id="cobertura" className={input} value={cobertura} onChange={(e) => setCobertura(Number(e.target.value))}>
                  {coberturas.map((c) => (
                    <option key={c.id} value={c.id} className="bg-black">{c.nombre}</option>
                  ))}
                </select>
              ) : (
                <p className="text-[14px] text-[#ff8a8a]">MeCubro no devolvió coberturas{errorCotizar ? ` (${errorCotizar})` : ""}. Probá en un rato.</p>
              )}
              <p className="text-[12px] text-[#988e90] mt-2">
                Cubre {fmtFecha(vigencia.desde)}
                {vigencia.hasta !== vigencia.desde ? ` al ${fmtFecha(vigencia.hasta)}` : ""}, de 00:00 a 23:59. El precio final lo ves en MercadoPago antes de pagar.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 text-[14px] text-[#cfc4c5]">
                <input type="checkbox" className="w-5 h-5" checked={conNoRep} onChange={(e) => setConNoRep(e.target.checked)} />
                El lugar pide cláusula de no repetición
              </label>
              {conNoRep ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-8">
                  <div>
                    <label className={label} htmlFor="ben-n">Razón social</label>
                    <input id="ben-n" className={input} value={benNombre} onChange={(e) => setBenNombre(e.target.value)} placeholder="Gobierno de la Ciudad de Buenos Aires" />
                  </div>
                  <div>
                    <label className={label} htmlFor="ben-c">CUIT</label>
                    <input id="ben-c" inputMode="numeric" className={input} value={benCuit} onChange={(e) => setBenCuit(e.target.value)} placeholder="34-99903208-9" />
                  </div>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onAsegurar}
              disabled={busy || elegidas.length === 0 || !coberturas.length}
              className="w-full sm:w-auto self-start bg-[#e5e2e1] text-[#131313] px-8 py-4 label-tech text-[13px] uppercase tracking-widest disabled:opacity-40"
            >
              {busy ? "Armando el seguro…" : `Asegurar ${elegidas.length === 1 ? "a 1 persona" : `a ${elegidas.length} personas`} y pagar a MeCubro`}
            </button>
            <p className="text-[12px] text-[#988e90] -mt-6">
              Un solo pago para todas. Lo cobra MeCubro (Insurond), no LABURO. Después vas a ver acá el certificado.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
