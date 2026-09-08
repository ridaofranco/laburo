"use client";

import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { CheckCircle2, Clock, MapPin, Tag } from "lucide-react";
import { LaburoWordmark } from "@/components/laburo-wordmark";
import { pedirLinkParaCotizar } from "@/app/(portal)/cotizaciones/licitacion-actions";

// ⚠️ El estado final se aplica PRIMERO: la animación desplaza, no revela. Una
// pantalla que arranca en opacity 0 y cuya animación no corre queda invisible
// sin ningún error, y esta la abre un proveedor desde un link.
const up = (delay = 0) => ({
  initial: { opacity: 1, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] as const },
});

const fmt = (iso: unknown, conHora = false) =>
  iso
    ? new Intl.DateTimeFormat("es-AR", {
        day: "2-digit",
        month: "long",
        ...(conHora ? { hour: "2-digit", minute: "2-digit" } : {}),
        timeZone: "America/Argentina/Buenos_Aires",
      }).format(new Date(String(iso)))
    : null;

export function LicitacionClient({
  slug,
  lic,
}: {
  slug: string;
  lic: Record<string, unknown>;
}) {
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const abierta = lic.abierta === true;
  const donde = [lic.ciudad, lic.provincia].filter(Boolean).join(", ");
  const campos = Array.isArray(lic.campos) ? (lic.campos as Record<string, unknown>[]) : [];

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const r = await pedirLinkParaCotizar(slug, fd);
      if (r.ok) setListo(true);
      else setError(r.error ?? "No pudimos mandarte el link.");
    });
  }

  return (
    <main className="min-h-dvh bg-black text-[#e5e2e1] px-6 py-14 md:py-20">
      <div className="max-w-[720px] mx-auto flex flex-col gap-10">
        <motion.div {...up(0)}>
          <LaburoWordmark className="h-[28px] md:h-[34px] w-auto" priority />
        </motion.div>

        <motion.header {...up(0.06)} className="flex flex-col gap-4">
          <p className="label-tech text-[11px] uppercase tracking-[0.2em] text-[#0047ff]">
            {String(lic.quien)} está pidiendo presupuesto
          </p>
          <h1 className="font-[family-name:var(--font-syne)] text-[30px] md:text-[44px] font-bold uppercase tracking-tight leading-[1.05]">
            {String(lic.titulo)}
          </h1>

          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-[#8a8a8a]">
            {lic.categoria ? (
              <span className="flex items-center gap-2">
                <Tag size={14} /> {String(lic.categoria)}
              </span>
            ) : null}
            {donde ? (
              <span className="flex items-center gap-2">
                <MapPin size={14} /> {donde}
              </span>
            ) : null}
            {lic.cierra_at ? (
              <span className="flex items-center gap-2">
                <Clock size={14} /> Cierra el {fmt(lic.cierra_at, true)}
              </span>
            ) : null}
          </div>
        </motion.header>

        {lic.descripcion ? (
          <motion.p {...up(0.12)} className="text-[17px] leading-[1.75] text-[#cfc4c5] whitespace-pre-wrap">
            {String(lic.descripcion)}
          </motion.p>
        ) : null}

        {lic.necesario_para ? (
          <motion.p {...up(0.14)} className="text-[15px] text-[#8a8a8a]">
            Lo necesitan para el <span className="text-[#e5e2e1]">{fmt(lic.necesario_para)}</span>.
          </motion.p>
        ) : null}

        {campos.length ? (
          <motion.section {...up(0.18)} className="border border-[#1a1a1a] bg-[#0a0a0a] p-6 flex flex-col gap-4">
            <p className="label-tech text-[11px] uppercase tracking-[0.2em] text-[#8a8a8a]">
              Lo que piden
            </p>
            <ul className="flex flex-col gap-3">
              {campos.filter((c) => String(c.etiqueta ?? c.label ?? c.nombre ?? "").trim()).map((c, i) => (
                <li key={i} className="text-[16px] text-[#e5e2e1] border-b border-[#1a1a1a] pb-3 last:border-0 last:pb-0">
                  {/* ⚠️ El campo se llama `etiqueta`. Es como lo escribe
                      staff_app_crear_pedido y como lo lee el portal y la
                      pantalla del que cotiza. Esta pantalla buscaba `label` y
                      `nombre`, que no existen en ningún lado: el resultado era
                      una lista de renglones VACÍOS, o sea el proveedor entrando
                      a la licitación sin ver qué le piden. Lo encontró Franco
                      probándolo con un pedido real. */}
                  {String(c.etiqueta ?? c.label ?? c.nombre ?? "")}
                  {c.detalle ? (
                    <span className="block text-[14px] text-[#8a8a8a] mt-1">{String(c.detalle)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </motion.section>
        ) : null}

        {/* ── Pedir el link ── */}
        <motion.section {...up(0.24)} className="border-t border-[#1a1a1a] pt-10">
          {!abierta ? (
            <p className="text-[17px] leading-[1.7] text-[#8a8a8a]">
              Esta licitación ya cerró. Si querés que te lleguen las próximas,
              publicá tus servicios en LABURO.
            </p>
          ) : listo ? (
            <div className="flex flex-col gap-3">
              <CheckCircle2 size={38} className="text-[#3dd68c]" strokeWidth={1.5} />
              <h2 className="font-[family-name:var(--font-syne)] text-[24px] font-bold uppercase tracking-tight">
                Te mandamos el link
              </h2>
              <p className="text-[16px] leading-[1.7] text-[#8a8a8a] max-w-[520px]">
                Revisá tu casilla: adentro está el link para cargar tu
                presupuesto. Si no lo ves, mirá el correo no deseado.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-6">
              <div>
                <h2 className="font-[family-name:var(--font-syne)] text-[24px] font-bold uppercase tracking-tight">
                  Quiero cotizar
                </h2>
                <p className="text-[15px] leading-[1.7] text-[#8a8a8a] mt-2 max-w-[520px]">
                  Dejá tu mail y te mandamos el link para cargar tu presupuesto.
                  No hace falta tener cuenta.
                </p>
              </div>

              {/* Honeypot */}
              <input type="text" name="sitio" tabIndex={-1} autoComplete="off" aria-hidden="true"
                     className="absolute left-[-9999px] w-px h-px overflow-hidden" />

              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="text"
                  name="nombre"
                  placeholder="Tu nombre o el de tu empresa"
                  maxLength={120}
                  className="flex-1 bg-transparent border-0 border-b border-[#4c4546] focus:border-[#e5e2e1] outline-none text-[16px] text-[#e5e2e1] py-3 rounded-none transition-colors placeholder:text-[#565656]"
                />
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="tu@email.com"
                  maxLength={200}
                  className="flex-1 bg-transparent border-0 border-b border-[#4c4546] focus:border-[#e5e2e1] outline-none text-[16px] text-[#e5e2e1] py-3 rounded-none transition-colors placeholder:text-[#565656]"
                />
              </div>

              {error ? (
                <p role="alert" className="text-[15px] text-[#ff8a8a]">{error}</p>
              ) : null}

              <button
                type="submit"
                disabled={pendiente}
                className="self-start bg-[#f5f5f5] text-black px-9 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:bg-[#0047ff] hover:text-white transition-colors disabled:opacity-50"
              >
                {pendiente ? "Mandando..." : "Mandame el link"}
              </button>
            </form>
          )}
        </motion.section>
      </div>
    </main>
  );
}
