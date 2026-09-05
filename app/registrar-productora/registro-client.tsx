"use client";

/**
 * El alta de quien arma eventos: tres campos obligatorios y dos opcionales.
 *
 * Sigue siendo el formulario más corto del sistema a propósito (/sumate pide 18
 * campos más CV, /registrar-salon 13, /registrar-proveedor 9): esta es la punta
 * que da volumen y cada campo de más es gente que no se anota.
 *
 * ── POR QUÉ EL TELÉFONO SÍ ENTRÓ (2/9) ───────────────────────────────────────
 * Hasta hoy eran dos campos, nombre y email, con el argumento de que "el resto
 * se pide cuando sirva para algo". El teléfono sirve para algo, y para lo más
 * caro que hay: si el mail de bienvenida no llega, sin teléfono esa productora
 * está perdida para siempre. Las otras tres altas lo piden; la oferta al staff
 * tiene respaldo por WhatsApp; esta alta no tenía ningún respaldo. Va a la base
 * (columna `telefono`, migración 0069), no al aviso: un dato de recuperación que
 * vive en un mensaje de Telegram no existe cuando hace falta.
 *
 * ── POR QUÉ LOS OTROS DOS NO SE PERSISTEN ────────────────────────────────────
 * "Qué eventos armás" y "cuántos por año" son cualitativos: le dicen a Franco
 * con quién está hablando antes de la primera charla, y ninguna pantalla los
 * consume. Pagar una columna por cada uno hoy es caro y prematuro, así que van
 * en el aviso interno, que ya lleva datos sueltos. "Qué eventos armás" es texto
 * libre y NO una lista de chips: la puerta se acaba de abrir a agencias, marcas
 * y particulares, y una taxonomía cerrada los volvería a dejar afuera.
 *
 * CUIT, dirección y web siguen sin pedirse: esas sí se piden cuando sirvan.
 */

import { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { LaburoWordmark } from "@/components/laburo-wordmark";
import { registrarProductora } from "./actions";

const up = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] as const, delay },
});

const input =
  "w-full bg-transparent border-0 border-b border-[#4c4546] focus:border-[#e5e2e1] outline-none text-[18px] leading-[1.6] text-[#e5e2e1] py-4 px-0 rounded-none transition-colors duration-300";
const label =
  "block mb-2 font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.1em] text-[#cfc4c5]";

/**
 * Rangos y no números exactos: nadie sabe de memoria cuántos eventos hizo, y un
 * campo numérico exacto se contesta mal o no se contesta. Cuatro opciones, que
 * es lo que hace falta para saber con quién se está hablando.
 */
const VOLUMEN = [
  "Es mi primer evento",
  "1 a 3 por año",
  "4 a 12 por año",
  "Más de 12 por año",
];

export function RegistroProductoraClient() {
  const [productora, setProductora] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [queEventos, setQueEventos] = useState("");
  const [volumen, setVolumen] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * null = todavía no se registró. true/false = se registró y el mail salió o
   * no. Un solo estado y no dos booleanos sueltos, mismo criterio que el
   * `result` de offer-form.tsx: así no existe el estado imposible "listo pero
   * sin saber qué pasó con el mail".
   */
  const [mailOk, setMailOk] = useState<boolean | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const r = await registrarProductora({
        productora,
        email,
        telefono,
        queEventos,
        volumen,
      });
      if (r.ok) setMailOk(r.mailOk ?? false);
      else setError(r.error ?? "No se pudo. Probá de nuevo.");
    } catch {
      setError("No se pudo. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-dvh flex flex-col items-center justify-center bg-black text-[#e5e2e1] px-6">
      <div className="relative z-10 w-full max-w-[448px] flex flex-col items-center">
        <motion.div {...up(0)} className="mb-4">
          <LaburoWordmark className="h-[56px] md:h-[72px] w-auto" priority />
        </motion.div>
        <motion.p
          {...up(0.05)}
          className="label-tech text-[12px] uppercase tracking-[0.3em] text-[#cfc4c5] mb-10"
        >
          Para el que arma el evento
        </motion.p>

        {mailOk !== null ? (
          /* Dos caras, molde de offer-form.tsx: la cuenta ya existe en los dos
           * casos, lo que cambia es si el mail salió. Antes esta pantalla decía
           * SIEMPRE "le mandamos un mail", aunque no hubiera salido, y la
           * persona se quedaba esperando algo que no iba a llegar. */
          <motion.div {...up(0.1)} className="w-full flex flex-col items-center gap-6">
            {mailOk ? (
              <p className="text-center text-[16px] leading-[1.6] text-[#cfc4c5]">
                Listo. Le mandamos a{" "}
                <span className="text-[#e5e2e1]">{email}</span> un mail para que
                elijas tu contraseña. Revisá tu casilla, y si no lo ves, mirá en
                spam.
              </p>
            ) : (
              <div className="w-full flex flex-col gap-4">
                <p className="text-center text-[16px] leading-[1.6] text-[#e5e2e1]">
                  Tu cuenta quedó creada, pero el mail no salió.
                </p>
                <p className="text-center text-[15px] leading-[1.6] text-[#cfc4c5]">
                  No perdiste nada: la cuenta de{" "}
                  <span className="text-[#e5e2e1]">{productora}</span> ya existe.
                  Entrá por <span className="text-[#e5e2e1]">Entrar</span> con{" "}
                  <span className="text-[#e5e2e1]">{email}</span> y pedí el link
                  desde ahí.
                </p>
                <p className="text-center text-[14px] leading-[1.6] text-[#8a8a8a]">
                  Y ya tenemos tu teléfono, así que si igual no podés entrar, te
                  escribimos nosotros.
                </p>
                <a
                  href="/entrar?c=productora"
                  className="mt-2 w-full border border-[#e5e2e1] bg-[#e5e2e1] text-black py-5 px-8 flex items-center justify-center gap-4 hover:bg-transparent hover:text-[#e5e2e1] transition-colors duration-150"
                >
                  <span className="font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.2em]">
                    Pedir el link para entrar
                  </span>
                  <ArrowRight size={18} strokeWidth={1.5} />
                </a>
              </div>
            )}
            {mailOk ? (
              <a
                href="/login"
                className="label-tech text-[12px] uppercase tracking-widest text-[#cfc4c5] hover:text-[#e5e2e1] border-b border-[#4c4546] hover:border-[#e5e2e1] pb-1 transition-colors"
              >
                Ya la definí, quiero entrar
              </a>
            ) : null}
          </motion.div>
        ) : (
          <motion.form {...up(0.15)} onSubmit={onSubmit} className="w-full flex flex-col gap-10">
            <p className="text-[16px] text-[#cfc4c5] leading-[1.6] -mt-2">
              Productora, agencia, marca o empresa: si armás eventos, esto es
              para vos. Cargá tu evento, publicá qué personal necesitás y recibí
              a la gente que quiere trabajar. Publicar es gratis.
            </p>

            <div>
              <label className={label} htmlFor="productora">
                Nombre de tu productora o empresa *
              </label>
              <input
                id="productora"
                className={input}
                value={productora}
                onChange={(e) => setProductora(e.target.value)}
                required
                autoComplete="organization"
                placeholder=" "
              />
            </div>

            <div>
              <label className={label} htmlFor="email">
                Tu email *
              </label>
              <input
                id="email"
                type="email"
                className={input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder=" "
              />
              <p className="mt-3 text-[13px] text-[#8a8a8a] leading-[1.5]">
                Con este mail vas a entrar. Te mandamos un link para que elijas
                tu contraseña.
              </p>
            </div>

            <div>
              <label className={label} htmlFor="telefono">
                Teléfono / WhatsApp *
              </label>
              <input
                id="telefono"
                type="tel"
                className={input}
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                required
                autoComplete="tel"
                placeholder="11 5555 5555"
              />
              <p className="mt-3 text-[13px] text-[#8a8a8a] leading-[1.5]">
                Por si el mail no te llega. Es la única forma que tenemos de
                encontrarte.
              </p>
            </div>

            <div>
              <label className={label} htmlFor="que-eventos">
                Qué eventos armás
              </label>
              <input
                id="que-eventos"
                className={input}
                value={queEventos}
                onChange={(e) => setQueEventos(e.target.value)}
                placeholder="Ej: casamientos y eventos corporativos"
              />
            </div>

            <div>
              <label className={label} htmlFor="volumen">
                Cuántos eventos por año
              </label>
              <select
                id="volumen"
                className={`${input} appearance-none`}
                value={volumen}
                onChange={(e) => setVolumen(e.target.value)}
              >
                <option value="" className="bg-black">
                  Prefiero no decir
                </option>
                {VOLUMEN.map((v) => (
                  <option key={v} value={v} className="bg-black">
                    {v}
                  </option>
                ))}
              </select>
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
                {loading ? "Un segundo…" : "Crear mi cuenta"}
              </span>
              <ArrowRight size={18} strokeWidth={1.5} />
            </button>
            {/* Términos y privacidad, al lado del botón que los acepta. Acá y
                no en un pie de página: el momento de decirlo es cuando la
                persona está por mandar sus datos, no en una pantalla aparte que
                nadie abre. */}
            <p className="text-[13px] text-[#8a8a8a] leading-[1.6] mt-4 text-center">
              Al continuar aceptás los{" "}
              <a href="/terminos" className="text-[#cfc4c5] border-b border-[#4c4546] hover:text-[#e5e2e1] hover:border-[#e5e2e1] transition-colors">términos</a>
              {" "}y la{" "}
              <a href="/privacidad" className="text-[#cfc4c5] border-b border-[#4c4546] hover:text-[#e5e2e1] hover:border-[#e5e2e1] transition-colors">política de privacidad</a>.
            </p>


            <div className="w-full border-t border-[#4c4546]/60 pt-8 flex flex-col items-center gap-3">
              <a
                href="/login"
                className="font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.1em] text-[#988e90] hover:text-[#e5e2e1] transition-colors"
              >
                ¿Ya tenés cuenta? Entrá acá
              </a>
              <a
                href="/acceso-staff"
                className="font-[family-name:var(--font-geist)] text-[11px] uppercase tracking-[0.1em] text-[#6f6f6f] hover:text-[#cfc4c5] transition-colors"
              >
                ¿Trabajás en eventos? Entrá como staff
              </a>
            </div>
          </motion.form>
        )}
      </div>
    </main>
  );
}
