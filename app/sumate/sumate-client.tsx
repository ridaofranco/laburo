"use client";

/**
 * /sumate tiene dos caminos y esta pieza es la que los sostiene.
 *
 * Por defecto arranca en el CORTO (adjuntar el CV y listo). El formulario largo
 * de siempre sigue existiendo, a un click, para el que prefiere escribir todo.
 * La pantalla de éxito es una sola y vive acá, así los dos caminos terminan en
 * el mismo lugar y no se van despegando con el tiempo.
 */

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { CheckCircle2 } from "lucide-react";
import { RegistroRapido } from "./registro-rapido";
import { RegistroForm } from "./registro-form";

const SYNE = "font-[family-name:var(--font-syne)]";

type Modo = "rapido" | "completo";

/** Pantalla de éxito, compartida por los dos caminos. */
export function RegistroListo({ modo }: { modo: Modo }) {
  return (
    <div className="max-w-[720px] mx-auto w-full px-6 md:px-20 py-24 text-center">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
        <CheckCircle2 size={64} className="text-[#3dd68c] mx-auto mb-8" strokeWidth={1.5} />
        <h1 className={`${SYNE} text-[40px] md:text-[64px] font-extrabold text-[#e5e2e1] uppercase tracking-tight leading-none`}>
          Quedaste registrado/a
        </h1>
        <p className="text-[18px] text-[#cfc4c5] mt-6 max-w-[460px] mx-auto leading-[1.6]">
          Te sumaste al pool de SOMOS DER. Cuando haya un evento que encaje con
          tu perfil, te llega la oferta. Podés entrar a tu cuenta con este mismo email.
        </p>
        {modo === "rapido" ? (
          <p className="text-[16px] text-[#988e90] mt-5 max-w-[460px] mx-auto leading-[1.6]">
            Tus datos los sacamos del CV. Cuando tengas un rato, entrá a tu perfil
            y revisalos: cuanto más completo esté, más fácil es que te encontremos
            para un trabajo.
          </p>
        ) : null}
        <Link href="/acceso-staff" className="mt-8 inline-block label-tech text-[12px] text-[#e5e2e1] hover:opacity-70 border-b border-[#4c4546] pb-1 uppercase tracking-widest">
          Entrar a mi cuenta
        </Link>
      </motion.div>
    </div>
  );
}

export function SumateClient() {
  const [modo, setModo] = useState<Modo>("rapido");
  const [done, setDone] = useState<Modo | null>(null);

  if (done) return <RegistroListo modo={done} />;

  return modo === "rapido" ? (
    <RegistroRapido onDone={() => setDone("rapido")} onFormularioLargo={() => setModo("completo")} />
  ) : (
    <RegistroForm onDone={() => setDone("completo")} onVolver={() => setModo("rapido")} />
  );
}
