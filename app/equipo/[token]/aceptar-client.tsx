"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { LaburoWordmark } from "@/components/laburo-wordmark";
import { createClient } from "@/lib/supabase/client";
import { aceptarInvitacion } from "./actions";

function nombreRol(rol: string): string {
  switch (rol) {
    case "manager": return "Gerente";
    case "writer": return "Editor";
    case "viewer": return "Solo lectura";
    default: return rol;
  }
}
function queHace(rol: string): string {
  switch (rol) {
    case "manager": return "Vas a poder buscar staff, armar eventos, mandar ofertas y sumar gente al equipo.";
    case "writer": return "Vas a poder buscar staff, armar eventos y mandar ofertas.";
    case "viewer": return "Vas a poder mirar los eventos y el equipo, sin hacer cambios.";
    default: return "Vas a poder trabajar sobre los eventos de la productora.";
  }
}

const up = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
});

export function AceptarInvitacion({
  token,
  invitacion,
  emailSesion,
}: {
  token: string;
  invitacion: Record<string, unknown> | null;
  emailSesion: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [pendiente, startTransition] = useTransition();

  const ok = invitacion?.ok === true;
  const org = String(invitacion?.organizacion ?? "una productora");
  const email = String(invitacion?.email ?? "");
  const rol = String(invitacion?.rol ?? "writer");

  const MOTIVOS: Record<string, string> = {
    no_existe: "Este link no es válido. Pedile a la productora que te invite de nuevo.",
    revocada: "La productora canceló esta invitación.",
    ya_aceptada: "Esta invitación ya la usaste. Entrá con tu cuenta.",
    vencida: "Esta invitación venció. Pedile a la productora que te invite de nuevo.",
  };

  function onAceptar() {
    setError(null);
    startTransition(async () => {
      const r = await aceptarInvitacion(token);
      if (r.ok) {
        setListo(true);
        // Un respiro para que se lea el "listo" antes de mandarlo adentro.
        setTimeout(() => router.push("/dashboard"), 1200);
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <main className="min-h-dvh bg-black text-[#e5e2e1] flex flex-col items-center justify-center px-6 py-20">
      <motion.div {...up(0)} className="w-full max-w-[520px] flex flex-col items-start gap-10">
        <LaburoWordmark className="h-[48px] md:h-[64px] w-auto" priority />

        {listo ? (
          <div className="flex flex-col gap-4">
            <CheckCircle2 size={44} className="text-[#3dd68c]" strokeWidth={1.5} />
            <h1 className="font-[family-name:var(--font-syne)] text-[30px] md:text-[38px] font-bold uppercase tracking-tight leading-[1.05]">
              Ya estás adentro
            </h1>
            <p className="text-[17px] leading-[1.7] text-[#8a8a8a]">
              Te sumamos al equipo de {org}. Te llevamos a tu panel.
            </p>
          </div>
        ) : ok ? (
          <div className="flex flex-col gap-6 w-full">
            <div>
              <p className="label-tech text-[11px] uppercase tracking-[0.2em] text-[#0047ff] mb-4">
                Invitación al equipo
              </p>
              <h1 className="font-[family-name:var(--font-syne)] text-[30px] md:text-[40px] font-bold uppercase tracking-tight leading-[1.05]">
                {org} te sumó a su equipo
              </h1>
            </div>

            <p className="text-[17px] leading-[1.7] text-[#8a8a8a]">
              Entrás como <strong className="text-[#e5e2e1]">{nombreRol(rol)}</strong>.{" "}
              {queHace(rol)}
            </p>

            <div className="border border-[#1a1a1a] bg-[#0a0a0a] p-5">
              <p className="label-tech text-[11px] uppercase tracking-[0.1em] text-[#8a8a8a] mb-2">
                La invitación es para
              </p>
              <p className="text-[17px] text-[#e5e2e1] break-all">{email}</p>
            </div>

            {/* ⚠️ SIN SESIÓN NO SE PUEDE ACEPTAR, y hay que decirlo antes de que
                apriete: la RPC pide una sesión con esa misma dirección. */}
            {!emailSesion ? (
              <div className="flex flex-col gap-4">
                <p className="text-[15px] leading-[1.7] text-[#cfc4c5]">
                  Para aceptar, entrá con <strong>{email}</strong>. Si todavía no
                  tenés cuenta, se crea con esa misma dirección.
                </p>
                {/* ⚠️ `/entrar` NO soporta volver a donde estabas (no hay
                    `?next=`), así que no se promete: se le dice que vuelva a
                    abrir el link del mail. Prometer un regreso que no pasa es
                    peor que pedir un paso más. */}
                <Link
                  href="/entrar"
                  className="self-start inline-flex items-center gap-3 bg-[#f5f5f5] text-black px-8 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:bg-[#0047ff] hover:text-white transition-colors"
                >
                  Entrar con mi cuenta <ArrowRight size={16} />
                </Link>
                <p className="text-[14px] leading-[1.7] text-[#8a8a8a]">
                  Cuando entres, volvé a abrir este link desde el mail para
                  terminar de sumarte.
                </p>
              </div>
            ) : emailSesion.toLowerCase() !== email.toLowerCase() ? (
              <div className="flex flex-col gap-4">
                <p className="text-[15px] leading-[1.7] text-[#ffb4ab]">
                  Estás con <strong>{emailSesion}</strong>, y esta invitación es
                  para <strong>{email}</strong>. Salí y volvé a entrar con esa
                  dirección.
                </p>
                {/* Cierra la sesión y se queda EN ESTA MISMA URL: así después
                    de entrar con la dirección correcta ya está donde tiene que
                    estar, sin volver al mail. */}
                <button
                  type="button"
                  onClick={async () => {
                    await createClient().auth.signOut();
                    router.refresh();
                  }}
                  className="self-start label-tech text-[12px] uppercase tracking-[0.1em] border border-[#4c4546] px-6 py-3 hover:border-[#e5e2e1] transition-colors"
                >
                  Cambiar de cuenta
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onAceptar}
                disabled={pendiente}
                className="self-start inline-flex items-center gap-3 bg-[#f5f5f5] text-black px-8 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:bg-[#0047ff] hover:text-white transition-colors disabled:opacity-50"
              >
                {pendiente ? "Sumándote..." : "Entrar al equipo"}
                {!pendiente ? <ArrowRight size={16} /> : null}
              </button>
            )}

            {error ? (
              <p role="alert" className="text-[15px] leading-[1.6] text-[#ff8a8a]">
                {error}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <h1 className="font-[family-name:var(--font-syne)] text-[28px] md:text-[34px] font-bold uppercase tracking-tight leading-[1.05]">
              Este link no sirve
            </h1>
            <p className="text-[17px] leading-[1.7] text-[#8a8a8a]">
              {MOTIVOS[String(invitacion?.reason ?? "")] ??
                "No encontramos esta invitación. Pedile a la productora que te invite de nuevo."}
            </p>
            <Link
              href="/entrar"
              className="self-start label-tech text-[12px] uppercase tracking-[0.1em] border border-[#4c4546] px-6 py-3 hover:border-[#e5e2e1] transition-colors"
            >
              Ir a LABURO
            </Link>
          </div>
        )}
      </motion.div>
    </main>
  );
}
