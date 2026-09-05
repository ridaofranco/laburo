"use client";

/**
 * Las dos respuestas, con el mismo peso visual. Ver el header de page.tsx.
 */

import { useState, useTransition } from "react";
import { responderVisibilidad } from "./actions";

export function VisibilidadClient({
  profileId,
  token,
  nombre,
  yaRespondio,
}: {
  profileId: string;
  token: string;
  nombre: string | null;
  yaRespondio: boolean | null;
}) {
  const [resultado, setResultado] = useState<boolean | null>(yaRespondio);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const responder = (quiere: boolean) => {
    setError(null);
    startTransition(async () => {
      const r = await responderVisibilidad(profileId, token, quiere);
      if (!r.ok) setError(r.error ?? "No se pudo guardar.");
      else setResultado(quiere);
    });
  };

  const saludo = nombre?.trim() ? `${nombre.trim()}, ` : "";

  if (resultado !== null) {
    return (
      <main className="min-h-dvh bg-[#131313] text-[#e5e2e1] flex flex-col items-center justify-center px-6 gap-5 text-center">
        <h1 className="t-section uppercase">Listo</h1>
        <p className="text-[17px] text-[#cfc4c5] max-w-[460px] leading-[1.6]">
          {resultado
            ? "Tu perfil ahora lo pueden ver otras productoras de la red. Tu mail, tu teléfono y tu documento siguen sin mostrarse: te escriben desde LABURO."
            : "Tu perfil lo sigue viendo solo la productora donde te anotaste. No compartimos nada con nadie más."}
        </p>
        <button
          type="button"
          onClick={() => responder(!resultado)}
          disabled={pendiente}
          className="mt-2 label-tech text-[12px] uppercase tracking-[0.2em] text-[#988e90] hover:text-[#e5e2e1] border-b border-[#4c4546] hover:border-[#e5e2e1] pb-1 transition-colors disabled:opacity-60"
        >
          {pendiente ? "Cambiando…" : "Cambiar de opinión"}
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#131313] text-[#e5e2e1] flex flex-col items-center justify-center px-6 py-16">
      <div className="max-w-[560px] w-full flex flex-col gap-6">
        <h1 className="t-display">
          {saludo}¿querés que otras productoras te vean?
        </h1>

        <div className="flex flex-col gap-4 text-[16px] text-[#cfc4c5] leading-[1.7]">
          <p>
            Hasta ahora tu perfil lo veía solo{" "}
            <strong className="text-[#e5e2e1]">SOMOS DER</strong>, que es donde
            te anotaste. Estamos abriendo LABURO a otras productoras, y no vamos
            a mostrar tu perfil sin preguntarte.
          </p>
          <p>
            Si decís que sí, te pueden llegar propuestas de más gente.{" "}
            <strong className="text-[#e5e2e1]">
              Tu mail, tu teléfono y tu documento no se muestran en ningún caso
            </strong>
            : las ofertas te llegan por LABURO, como siempre.
          </p>
          <p className="text-[15px] text-[#988e90]">
            Podés cambiar de opinión cuando quieras con este mismo link.
          </p>
        </div>

        {error && (
          <p className="text-[15px] text-[#ffb4b4] border border-[#ffb4b4]/40 px-4 py-3">
            {error}
          </p>
        )}

        {/* Mismo tamaño, mismo peso: es una pregunta, no un embudo. */}
        <div className="flex flex-col sm:flex-row gap-3 mt-2">
          <button
            type="button"
            onClick={() => responder(true)}
            disabled={pendiente}
            className="flex-1 min-h-[56px] px-6 border border-[#e5e2e1] bg-[#e5e2e1] text-black label-tech text-[12px] uppercase tracking-[0.2em] hover:bg-transparent hover:text-[#e5e2e1] transition-colors disabled:opacity-60"
          >
            Sí, que me vean
          </button>
          <button
            type="button"
            onClick={() => responder(false)}
            disabled={pendiente}
            className="flex-1 min-h-[56px] px-6 border border-[#e5e2e1] bg-transparent text-[#e5e2e1] label-tech text-[12px] uppercase tracking-[0.2em] hover:bg-[#e5e2e1] hover:text-black transition-colors disabled:opacity-60"
          >
            No, solo SOMOS DER
          </button>
        </div>
      </div>
    </main>
  );
}
