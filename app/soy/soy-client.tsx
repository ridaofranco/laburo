"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Plus, Check } from "lucide-react";
import { LaburoWordmark } from "@/components/laburo-wordmark";

/**
 * ⚠️ LA ANIMACIÓN NO PUEDE DECIDIR SI EL CONTENIDO SE VE.
 *
 * La primera versión de esta pantalla arrancaba en `opacity: 0` y se reveló
 * negra en la captura de prueba: el texto estaba en el DOM y no se veía nada, sin
 * ningún error que lo explicara. Es una trampa que ya costó cara dos veces en
 * PASE (5/8): el formulario de una landing y el pase al que lleva el link del
 * mail, que la persona abre PARADA EN LA PUERTA del evento.
 *
 * La animación puede no correr por mil motivos que no controlamos: la pestaña
 * estaba en segundo plano, el navegador frena `requestAnimationFrame`, la
 * persona tiene "reducir movimiento", o la librería no cargó.
 *
 * Así que el estado final se aplica PRIMERO (`opacity: 1`) y la animación es un
 * agregado sobre algo que ya se ve: entra desplazándose, no apareciendo.
 */
const up = (delay = 0) => ({
  initial: { opacity: 1, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] as const },
});

interface Sombrero {
  id: string;
  titulo: string;
  bajada: string;
  /** Dónde entra si ya lo tiene. */
  panel: string;
  /** Dónde se da de alta si todavía no lo tiene. */
  alta: string;
  altaTexto: string;
  tiene: boolean;
  /** Una línea con el dato concreto cuando ya lo tiene. */
  detalle?: string | null;
}

export function SoyClient({
  email,
  productora,
  esStaff,
  esProveedor,
}: {
  email: string;
  productora: { nombre: string; rol: string | null } | null;
  esStaff: boolean;
  esProveedor: boolean;
}) {
  const sombreros: Sombrero[] = [
    {
      id: "productora",
      titulo: "Armo eventos",
      bajada:
        "Buscás staff, pedís precios a proveedores y coordinás el evento. Es el lado de la productora.",
      panel: "/dashboard",
      alta: "/registrar-productora",
      altaTexto: "Crear mi cuenta de productora",
      tiene: !!productora,
      detalle: productora ? productora.nombre : null,
    },
    {
      id: "staff",
      titulo: "Trabajo en eventos",
      bajada:
        "Tu perfil y tu CV quedan en el pool, y te llegan ofertas de trabajo de las productoras.",
      panel: "/panel-staff",
      alta: "/sumate",
      altaTexto: "Sumarme al pool",
      tiene: esStaff,
    },
    {
      id: "proveedor",
      titulo: "Presto un servicio",
      bajada:
        "Publicás lo que hacés (sonido, catering, producción, lo que sea) y te llegan pedidos de cotización.",
      panel: "/mi-proveedor",
      alta: "/registrar-proveedor",
      altaTexto: "Publicar mis servicios",
      tiene: esProveedor,
    },
  ];

  const tiene = sombreros.filter((s) => s.tiene);
  const faltan = sombreros.filter((s) => !s.tiene);

  return (
    <main className="min-h-dvh bg-black text-[#e5e2e1] px-6 py-16 md:py-24">
      <div className="max-w-[760px] mx-auto flex flex-col gap-12">
        <motion.div {...up(0)} className="flex flex-col gap-6">
          <LaburoWordmark className="h-[32px] md:h-[40px] w-auto" priority />
          <div>
            <h1 className="font-[family-name:var(--font-syne)] text-[32px] md:text-[44px] font-bold uppercase tracking-tight leading-[1.05]">
              ¿Con qué entrás?
            </h1>
            <p className="text-[17px] leading-[1.7] text-[#8a8a8a] mt-4 max-w-[560px]">
              Una misma cuenta puede ser varias cosas a la vez. Con{" "}
              <span className="text-[#e5e2e1]">{email}</span> podés armar tus
              eventos, trabajar en los de otros y ofrecer tus servicios, sin
              registrarte de nuevo.
            </p>
          </div>
        </motion.div>

        {/* ── Los que ya tenés ── */}
        {tiene.length ? (
          <motion.section {...up(0.08)} className="flex flex-col gap-4">
            <p className="label-tech text-[11px] uppercase tracking-[0.2em] text-[#8a8a8a]">
              Lo que ya sos
            </p>
            {tiene.map((s) => (
              <Link
                key={s.id}
                href={s.panel}
                className="group border border-[#1a1a1a] bg-[#0a0a0a] p-6 md:p-8 flex items-center justify-between gap-6 hover:border-[#0047ff] transition-colors duration-300"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-[#3dd68c] shrink-0" />
                    <h2 className="font-[family-name:var(--font-syne)] text-[20px] md:text-[24px] font-bold uppercase tracking-tight">
                      {s.titulo}
                    </h2>
                  </div>
                  {s.detalle ? (
                    <p className="text-[14px] text-[#0047ff] mt-2 truncate">{s.detalle}</p>
                  ) : null}
                  <p className="text-[15px] leading-[1.6] text-[#8a8a8a] mt-2 max-w-[460px]">
                    {s.bajada}
                  </p>
                </div>
                <ArrowRight
                  size={22}
                  className="shrink-0 text-[#8a8a8a] group-hover:text-[#0047ff] transition-colors"
                />
              </Link>
            ))}
          </motion.section>
        ) : null}

        {/* ── Los que podés sumar ──
          * ⚠️ Esto es lo que no existía en ningún lado: para ponerse un segundo
          * sombrero había que salir, volver a la puerta y anotarse de nuevo como
          * si fueras otra persona. */}
        {faltan.length ? (
          <motion.section {...up(0.16)} className="flex flex-col gap-4">
            <p className="label-tech text-[11px] uppercase tracking-[0.2em] text-[#8a8a8a]">
              {tiene.length ? "Podés sumar" : "Empezá por acá"}
            </p>
            {faltan.map((s) => (
              <Link
                key={s.id}
                href={s.alta}
                className="group border border-[#1a1a1a] p-6 md:p-8 flex items-center justify-between gap-6 hover:border-[#4c4546] transition-colors duration-300"
              >
                <div className="min-w-0">
                  <h2 className="font-[family-name:var(--font-syne)] text-[20px] md:text-[24px] font-bold uppercase tracking-tight text-[#cfc4c5]">
                    {s.titulo}
                  </h2>
                  <p className="text-[15px] leading-[1.6] text-[#8a8a8a] mt-2 max-w-[460px]">
                    {s.bajada}
                  </p>
                  <p className="label-tech text-[11px] uppercase tracking-[0.15em] text-[#e5e2e1] mt-4 flex items-center gap-2">
                    <Plus size={13} /> {s.altaTexto}
                  </p>
                </div>
                <ArrowRight
                  size={22}
                  className="shrink-0 text-[#4c4546] group-hover:text-[#8a8a8a] transition-colors"
                />
              </Link>
            ))}
          </motion.section>
        ) : null}

        <motion.p {...up(0.24)} className="text-[14px] leading-[1.7] text-[#8a8a8a] border-t border-[#1a1a1a] pt-8">
          Todo con la misma cuenta y el mismo mail. Volvés acá cuando quieras
          cambiar de lado.
        </motion.p>
      </div>
    </main>
  );
}
