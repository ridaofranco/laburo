"use client";

/**
 * LA PUERTA ÚNICA. Primero preguntamos qué sos, después pedimos el mail.
 *
 * ── EL PROBLEMA QUE RESUELVE ────────────────────────────────────────────────
 * Franco, 5/8: *"Yo necesito que ingresar sea facil, me parece que la
 * complicamos un monton"*. Y tenía razón: había NUEVE puertas y tres mecanismos
 * distintos. `/login` para productoras y `/acceso-staff` para el staff eran dos
 * pantallas idénticas para dos públicos, así que la persona tenía que adivinar
 * cuál era la suya; y el proveedor directamente no podía "ingresar", porque
 * dependía de encontrar un mail viejo con un link que vencía a los 30 días.
 *
 * ── POR QUÉ PREGUNTA PRIMERO Y NO ADIVINA ───────────────────────────────────
 * Decisión de Franco entre las dos opciones: tres botones grandes antes del
 * formulario. Cuesta un click, y a cambio la persona nunca se pregunta si está
 * en el lugar correcto. El rol que elige viaja como HINT a /auth/callback, que
 * es el único que decide identidad: si el hint no matchea nada real, se ignora.
 * Elegir mal acá no rompe nada ni da acceso a nada.
 *
 * ── LO QUE NO SE TOCÓ ───────────────────────────────────────────────────────
 * `/login` y `/acceso-staff` siguen funcionando igual. Esta pantalla se suma, no
 * reemplaza: si algo de acá falla, nadie se queda afuera.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { LaburoWordmark } from "@/components/laburo-wordmark";
import { createClient } from "@/lib/supabase/client";
import { signInWithPassword } from "@/lib/auth-password";
import { proveedorPuedeCrearCuenta } from "./actions";

type Rol = "productora" | "staff" | "proveedor";

const ROLES: { id: Rol; titulo: string; bajada: string }[] = [
  {
    id: "productora",
    titulo: "Soy productora",
    bajada: "Armo eventos y necesito personal o proveedores",
  },
  {
    id: "staff",
    titulo: "Trabajo en eventos",
    bajada: "Quiero que me lleguen ofertas de trabajo",
  },
  {
    id: "proveedor",
    titulo: "Soy proveedor",
    bajada: "Presto un servicio: sonido, catering, seguridad, lo que sea",
  },
];

const MOTIVOS: Record<string, string> = {
  link_vencido: "Ese link ya se usó o venció. Pedí uno nuevo desde acá.",
  sin_sesion: "Se cerró tu sesión antes de terminar de entrar. Probá de nuevo.",
  sin_perfil:
    "Entraste bien, pero con este mail todavía no hay ningún perfil. Registrate abajo y en un minuto estás adentro.",
};

/** A dónde manda el botón de registrarse, según lo que la persona dijo que es. */
const ALTA: Record<Rol, { href: string; texto: string }> = {
  productora: { href: "/registrar-productora", texto: "Crear la cuenta de mi productora" },
  staff: { href: "/sumate", texto: "Sumarme al pool" },
  proveedor: { href: "/registrar-proveedor", texto: "Publicar mis servicios" },
};

const input =
  "w-full bg-transparent border-0 border-b border-[#4c4546] focus:border-[#e5e2e1] outline-none text-[18px] leading-[1.6] text-[#e5e2e1] py-4 px-0 rounded-none transition-colors duration-300";
const label =
  "block mb-2 font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.1em] text-[#cfc4c5]";

export function EntrarClient() {
  const [rol, setRol] = useState<Rol | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [linkMandado, setLinkMandado] = useState(false);
  const [rebote, setRebote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setRebote(MOTIVOS[p.get("motivo") ?? ""] ?? null);
    // Se puede llegar directo con el rol ya elegido (?como=proveedor), que es
    // lo que usan los links de "cambiar de perfil" y los rebotes.
    const c = p.get("como");
    if (c === "productora" || c === "staff" || c === "proveedor") setRol(c);
  }, []);

  const callbackUrl = (r: Rol) =>
    `${window.location.origin}/auth/callback?como=${r}`;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !rol || loading) return;
    setError(null);

    // Con contraseña escrita, entra con ella. Vacía, va el link, igual que en
    // las puertas viejas: el que nunca definió una no pierde su camino.
    if (password) {
      setLoading(true);
      const r = await signInWithPassword(email, password);
      setLoading(false);
      if (!r.ok) {
        setError(r.error ?? "No pudimos entrar.");
        return;
      }
      window.location.href = `/auth/callback?como=${rol}&from=password`;
      return;
    }

    setLoading(true);
    // El proveedor viejo no tiene usuario de auth todavía (el diseño original
    // era sin cuenta). Solo para él, y solo si su mail YA está cargado como
    // proveedor, se permite crearlo en este primer ingreso.
    const crearSiHaceFalta =
      rol === "proveedor" ? await proveedorPuedeCrearCuenta(email) : false;

    const supabase = createClient();
    await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl(rol),
        shouldCreateUser: crearSiHaceFalta,
      },
    });
    setLoading(false);
    // Respuesta SIEMPRE uniforme (decisión de Franco, 28/7): mostrar si la
    // cuenta existe o no sería un oráculo de qué mails están registrados.
    setLinkMandado(true);
  }

  return (
    <main className="relative min-h-dvh flex flex-col items-center justify-center bg-black text-[#e5e2e1] px-6 py-16">
      <div className="relative z-10 w-full max-w-[460px] flex flex-col items-center">
        <div className="mb-10">
          <LaburoWordmark className="h-[48px] md:h-[64px] w-auto" priority />
        </div>

        {rebote ? (
          <p className="w-full mb-8 text-[15px] leading-[1.6] text-[#cfc4c5] border-l-2 border-[#0047ff] pl-5">
            {rebote}
          </p>
        ) : null}

        {/* ── Paso 1: qué sos ─────────────────────────────────────────── */}
        {!rol ? (
          <div className="w-full flex flex-col gap-8">
            <p className="label-tech text-[12px] uppercase tracking-[0.3em] text-[#cfc4c5] text-center">
              ¿Qué sos?
            </p>
            <div className="flex flex-col gap-4">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setRol(r.id);
                    setError(null);
                  }}
                  className="w-full text-left border border-[#4c4546] hover:border-[#e5e2e1] hover:bg-[#0a0a0a] px-7 py-6 transition-colors cursor-pointer group"
                >
                  <span className="block font-[family-name:var(--font-syne)] font-bold text-[20px] uppercase tracking-tight text-[#e5e2e1]">
                    {r.titulo}
                  </span>
                  <span className="block text-[14px] leading-[1.5] text-[#8a8a8a] mt-2 group-hover:text-[#cfc4c5] transition-colors">
                    {r.bajada}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : linkMandado ? (
          /* ── Link mandado ──────────────────────────────────────────── */
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="w-full flex flex-col items-center gap-6"
          >
            <p className="text-center text-[16px] leading-[1.6] text-[#cfc4c5]">
              Si <span className="text-[#e5e2e1]">{email}</span> tiene cuenta, te
              mandamos un link para entrar. Revisá tu casilla, y si no lo ves,
              mirá en spam.
            </p>
            <p className="text-center text-[14px] leading-[1.6] text-[#8a8a8a]">
              Abrilo desde este mismo navegador. Si lo abrís desde el visor de
              Gmail puede fallar.
            </p>
            <Link
              href={ALTA[rol].href}
              className="label-tech text-[12px] uppercase tracking-widest text-[#cfc4c5] hover:text-[#e5e2e1] border-b border-[#4c4546] hover:border-[#e5e2e1] pb-1 transition-colors"
            >
              ¿Todavía no tenés cuenta? {ALTA[rol].texto}
            </Link>
          </motion.div>
        ) : (
          /* ── Paso 2: mail y contraseña ─────────────────────────────── */
          <form onSubmit={onSubmit} className="w-full flex flex-col gap-9">
            <button
              type="button"
              onClick={() => {
                setRol(null);
                setError(null);
              }}
              className="self-start inline-flex items-center gap-2 label-tech text-[11px] uppercase tracking-[0.2em] text-[#8a8a8a] hover:text-[#e5e2e1] transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} strokeWidth={1.5} />
              {ROLES.find((r) => r.id === rol)?.titulo}
            </button>

            <div>
              <label className={label} htmlFor="email">
                Tu email
              </label>
              <input
                id="email"
                type="email"
                className={input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            <div>
              <label className={label} htmlFor="password">
                Tu contraseña
              </label>
              <input
                id="password"
                type="password"
                className={input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <p className="mt-3 text-[13px] text-[#8a8a8a] leading-[1.5]">
                Si no tenés o no te acordás, dejala vacía y te mandamos un link
                para entrar sin contraseña.
              </p>
            </div>

            {error ? (
              <p role="alert" className="text-[14px] leading-[1.5] text-[#ff8a8a]">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full border border-[#e5e2e1] bg-[#e5e2e1] text-black py-6 px-8 flex items-center justify-center gap-4 hover:bg-transparent hover:text-[#e5e2e1] transition-colors duration-150 cursor-pointer disabled:opacity-50"
            >
              <span className="font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.2em]">
                {loading ? "Un segundo…" : "Entrar"}
              </span>
              <ArrowRight size={18} strokeWidth={1.5} />
            </button>

            <div className="w-full border-t border-[#4c4546]/60 pt-8 flex justify-center">
              <Link
                href={ALTA[rol].href}
                className="font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.1em] text-[#988e90] hover:text-[#e5e2e1] transition-colors text-center"
              >
                ¿Primera vez? {ALTA[rol].texto}
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
