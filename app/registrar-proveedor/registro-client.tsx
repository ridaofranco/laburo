"use client";

/**
 * El alta del proveedor. Formulario COMPLETO, no la versión corta.
 *
 * Decisión textual de Franco (3/8): "completo, todo lo que hace, dónde está, qué
 * servicios, todo junto, como corresponde". El perfil nace listo para
 * publicarse, sin un segundo paso donde se pierde la gente.
 *
 * ⚠️ POR QUÉ ACÁ NO HAY `initial: { opacity: 0 }` ENVOLVIENDO EL FORMULARIO
 * Es la trampa que ya mordió dos veces el 5/8: si el contenido vive adentro de
 * una animación de entrada con opacidad 0 y la animación no corre (JS que no
 * carga, motion que falla, un navegador raro), la pantalla queda VACÍA y no hay
 * ningún error que lo explique. Acá el formulario se renderiza sin depender de
 * nada: la única animación es la del bloque de "listo", que aparece DESPUÉS de
 * una acción del usuario y por lo tanto ya sabemos que el JS corre.
 *
 * ⚠️ TRES PANTALLAS: celular, tablet y computadora (regla fija de Franco, 5/8).
 * Por eso la grilla de servicios es de una columna hasta `sm`, y las provincias
 * van en chips que envuelven en vez de una fila que desborda.
 */

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Plus, X } from "lucide-react";
import { LaburoWordmark } from "@/components/laburo-wordmark";
import { CATEGORIAS_PROVEEDOR } from "@/lib/categorias-proveedor";
import { PROVINCIAS } from "@/lib/provincias";
import { registrarProveedor, type ServicioInput } from "./actions";

const input =
  "w-full bg-transparent border-0 border-b border-[#4c4546] focus:border-[#e5e2e1] outline-none text-[16px] leading-[1.6] text-[#e5e2e1] py-3 px-0 rounded-none transition-colors duration-300";
const label =
  "block mb-2 font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.1em] text-[#cfc4c5]";
const seccion =
  "label-tech text-[11px] uppercase tracking-[0.25em] text-[#0047ff] mb-6 block";

const servicioVacio = (): ServicioInput => ({
  categoria: "",
  titulo: "",
  descripcion: "",
  precio_desde: "",
  unidad: "",
  provincias: [],
});

export function RegistroProveedorClient() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [provincia, setProvincia] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [servicios, setServicios] = useState<ServicioInput[]>([servicioVacio()]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  function editarServicio(i: number, campo: keyof ServicioInput, valor: string) {
    setServicios((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, [campo]: valor } : s)),
    );
  }

  function toggleProvincia(i: number, prov: string) {
    setServicios((prev) =>
      prev.map((s, idx) =>
        idx === i
          ? {
              ...s,
              provincias: s.provincias.includes(prov)
                ? s.provincias.filter((p) => p !== prov)
                : [...s.provincias, prov],
            }
          : s,
      ),
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const r = await registrarProveedor({
        nombre,
        email,
        telefono,
        headline,
        bio,
        ciudad,
        provincia,
        website,
        instagram,
        servicios,
      });
      if (r.ok) setListo(true);
      else setError(r.error ?? "No se pudo. Probá de nuevo.");
    } catch {
      setError("No se pudo. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (listo) {
    return (
      <main className="relative min-h-dvh flex flex-col items-center justify-center bg-black text-[#e5e2e1] px-6 py-16">
        <div className="relative z-10 w-full max-w-[520px] flex flex-col items-center">
          <div className="mb-8">
            <LaburoWordmark className="h-[48px] md:h-[64px] w-auto" priority />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="w-full flex flex-col items-center gap-6"
          >
            <p className="text-center text-[16px] leading-[1.6] text-[#cfc4c5]">
              Listo, <span className="text-[#e5e2e1]">{nombre}</span> ya está
              publicado en el directorio. Te mandamos a{" "}
              <span className="text-[#e5e2e1]">{email}</span> el link para entrar
              a tu panel. Guardá ese mail, porque el link es la forma de volver a
              entrar. Si no lo ves, mirá en spam.
            </p>
            <Link
              href="/servicios"
              className="label-tech text-[12px] uppercase tracking-widest text-[#cfc4c5] hover:text-[#e5e2e1] border-b border-[#4c4546] hover:border-[#e5e2e1] pb-1 transition-colors"
            >
              Ver el directorio
            </Link>
          </motion.div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh bg-black text-[#e5e2e1] px-6 py-14 md:py-20">
      <div className="relative z-10 w-full max-w-[720px] mx-auto">
        <div className="flex flex-col items-start gap-3 mb-3">
          <LaburoWordmark className="h-[40px] md:h-[56px] w-auto" priority />
        </div>
        <p className="label-tech text-[12px] uppercase tracking-[0.3em] text-[#cfc4c5] mb-8">
          Para proveedores
        </p>

        <p className="text-[16px] md:text-[18px] text-[#cfc4c5] leading-[1.6] mb-12 max-w-[560px]">
          Publicá lo que hacés y dónde trabajás, y las productoras te encuentran
          cuando arman un evento. Estar en el directorio es gratis y no hace falta
          crear una cuenta.
        </p>

        <form onSubmit={onSubmit} className="w-full flex flex-col gap-14">
          {/* ── Quién sos ─────────────────────────────────────────────── */}
          <section>
            <span className={seccion}>01 // Quién sos</span>
            <div className="flex flex-col gap-8">
              <div>
                <label className={label} htmlFor="nombre">
                  Nombre de tu empresa o el tuyo *
                </label>
                <input
                  id="nombre"
                  className={input}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  autoComplete="organization"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div>
                  <label className={label} htmlFor="email">
                    Email *
                  </label>
                  <input
                    id="email"
                    type="email"
                    className={input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                  <p className="mt-3 text-[13px] text-[#8a8a8a] leading-[1.5]">
                    Acá te mandamos el link de tu panel y las consultas.
                  </p>
                </div>
                <div>
                  <label className={label} htmlFor="telefono">
                    Teléfono o WhatsApp
                  </label>
                  <input
                    id="telefono"
                    className={input}
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    autoComplete="tel"
                    placeholder="11 5555 5555"
                  />
                </div>
              </div>

              <div>
                <label className={label} htmlFor="headline">
                  En una línea, qué hacés
                </label>
                <input
                  id="headline"
                  className={input}
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Sonido e iluminación para eventos grandes"
                />
              </div>

              <div>
                <label className={label} htmlFor="bio">
                  Contanos un poco más
                </label>
                <textarea
                  id="bio"
                  className={`${input} resize-none`}
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Años de experiencia, con qué marcas trabajaste, qué te diferencia."
                />
              </div>
            </div>
          </section>

          {/* ── Dónde estás ───────────────────────────────────────────── */}
          <section>
            <span className={seccion}>02 // Dónde estás</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div>
                <label className={label} htmlFor="ciudad">
                  Ciudad
                </label>
                <input
                  id="ciudad"
                  className={input}
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                />
              </div>
              <div>
                <label className={label} htmlFor="provincia">
                  Provincia
                </label>
                <select
                  id="provincia"
                  className={`${input} appearance-none`}
                  value={provincia}
                  onChange={(e) => setProvincia(e.target.value)}
                >
                  <option value="" className="bg-black">
                    Elegí una
                  </option>
                  {PROVINCIAS.map((p) => (
                    <option key={p} value={p} className="bg-black">
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="website">
                  Sitio web
                </label>
                <input
                  id="website"
                  className={input}
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://"
                />
              </div>
              <div>
                <label className={label} htmlFor="instagram">
                  Instagram
                </label>
                <input
                  id="instagram"
                  className={input}
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="@tucuenta"
                />
              </div>
            </div>
          </section>

          {/* ── Qué ofrecés ───────────────────────────────────────────── */}
          <section>
            <span className={seccion}>03 // Qué ofrecés</span>
            <p className="text-[14px] text-[#8a8a8a] leading-[1.6] mb-8 -mt-2">
              Cargá un servicio por cada cosa distinta que hacés. Marcá las
              provincias donde trabajás: si no marcás ninguna, no vas a aparecer
              en las búsquedas.
            </p>

            <div className="flex flex-col gap-10">
              {servicios.map((s, i) => (
                <div
                  key={i}
                  className="border border-[#1a1a1a] p-5 md:p-7 flex flex-col gap-7"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="label-tech text-[11px] tracking-[0.25em] text-[#8a8a8a]">
                      Servicio {String(i + 1).padStart(2, "0")}
                    </span>
                    {servicios.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setServicios((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        className="text-[#8a8a8a] hover:text-[#ff8a8a] transition-colors cursor-pointer"
                        aria-label={`Sacar el servicio ${i + 1}`}
                      >
                        <X size={18} strokeWidth={1.5} />
                      </button>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-7">
                    <div>
                      <label className={label} htmlFor={`cat-${i}`}>
                        Rubro *
                      </label>
                      <input
                        id={`cat-${i}`}
                        className={input}
                        value={s.categoria}
                        onChange={(e) => editarServicio(i, "categoria", e.target.value)}
                        list="categorias-proveedor"
                        required
                        placeholder="Sonido"
                      />
                    </div>
                    <div>
                      <label className={label} htmlFor={`tit-${i}`}>
                        Qué ofrecés *
                      </label>
                      <input
                        id={`tit-${i}`}
                        className={input}
                        value={s.titulo}
                        onChange={(e) => editarServicio(i, "titulo", e.target.value)}
                        required
                        placeholder="Equipo completo para 500 personas"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={label} htmlFor={`desc-${i}`}>
                      Detalle
                    </label>
                    <textarea
                      id={`desc-${i}`}
                      className={`${input} resize-none`}
                      rows={2}
                      value={s.descripcion}
                      onChange={(e) => editarServicio(i, "descripcion", e.target.value)}
                      placeholder="Qué incluye, qué equipo, si va con operador."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-7">
                    <div>
                      <label className={label} htmlFor={`precio-${i}`}>
                        Precio desde (ARS)
                      </label>
                      <input
                        id={`precio-${i}`}
                        className={input}
                        value={s.precio_desde}
                        onChange={(e) => editarServicio(i, "precio_desde", e.target.value)}
                        inputMode="numeric"
                        placeholder="150000"
                      />
                      <p className="mt-3 text-[13px] text-[#8a8a8a] leading-[1.5]">
                        Es orientativo y podés dejarlo vacío. El precio final lo
                        arreglás vos con cada productora.
                      </p>
                    </div>
                    <div>
                      <label className={label} htmlFor={`unidad-${i}`}>
                        Por qué unidad
                      </label>
                      <input
                        id={`unidad-${i}`}
                        className={input}
                        value={s.unidad}
                        onChange={(e) => editarServicio(i, "unidad", e.target.value)}
                        placeholder="por evento, por día, por persona"
                      />
                    </div>
                  </div>

                  <div>
                    <span className={label}>Dónde trabajás *</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {PROVINCIAS.map((p) => {
                        const activa = s.provincias.includes(p);
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => toggleProvincia(i, p)}
                            aria-pressed={activa}
                            className={`px-3 py-2 text-[12px] leading-none border transition-colors cursor-pointer ${
                              activa
                                ? "border-[#0047ff] bg-[#0047ff] text-white"
                                : "border-[#4c4546] text-[#cfc4c5] hover:border-[#e5e2e1] hover:text-[#e5e2e1]"
                            }`}
                          >
                            {p}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setServicios((prev) => [...prev, servicioVacio()])}
              className="mt-8 inline-flex items-center gap-3 border border-[#4c4546] text-[#cfc4c5] hover:border-[#e5e2e1] hover:text-[#e5e2e1] py-4 px-6 transition-colors cursor-pointer"
            >
              <Plus size={16} strokeWidth={1.5} />
              <span className="font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.2em]">
                Sumar otro servicio
              </span>
            </button>
          </section>

          <datalist id="categorias-proveedor">
            {CATEGORIAS_PROVEEDOR.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>

          {error ? (
            <p role="alert" className="text-[14px] leading-[1.5] text-[#ff8a8a]">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-6">
            <button
              type="submit"
              disabled={loading}
              className="w-full border border-[#e5e2e1] bg-[#e5e2e1] text-black py-6 px-8 flex items-center justify-center gap-4 hover:bg-transparent hover:text-[#e5e2e1] transition-colors duration-150 cursor-pointer disabled:opacity-50"
            >
              <span className="font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.2em]">
                {loading ? "Un segundo…" : "Publicar mi perfil"}
              </span>
              <ArrowRight size={18} strokeWidth={1.5} />
            </button>
            <p className="text-[13px] text-[#8a8a8a] leading-[1.6] text-center">
              Al publicar, tu perfil aparece en el directorio y las productoras te
              pueden consultar. Podés editarlo o sacarlo cuando quieras desde el
              link que te mandamos por mail.
            </p>
          </div>

          <div className="w-full border-t border-[#4c4546]/60 pt-8 flex flex-col items-center gap-3">
            <Link
              href="/registrar-productora"
              className="font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.1em] text-[#988e90] hover:text-[#e5e2e1] transition-colors"
            >
              ¿Sos productora? Creá tu cuenta acá
            </Link>
            <Link
              href="/sumate"
              className="font-[family-name:var(--font-geist)] text-[11px] uppercase tracking-[0.1em] text-[#6f6f6f] hover:text-[#cfc4c5] transition-colors"
            >
              ¿Trabajás en eventos? Sumate al pool
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
