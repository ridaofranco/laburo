"use client";

/**
 * El alta del salón. Formulario COMPLETO, no la versión corta.
 *
 * Misma decisión que en el alta del proveedor (Franco, 3/8): *"completo, todo lo
 * que hace, dónde está, qué servicios, todo junto, como corresponde"*. El perfil
 * nace listo para publicarse, sin un segundo paso donde se pierde la gente.
 *
 * ⚠️ POR QUÉ ACÁ NO HAY `initial: { opacity: 0 }` ENVOLVIENDO EL FORMULARIO
 * Es la trampa que ya mordió DOS veces el 5/8: si el contenido vive adentro de
 * una animación de entrada con opacidad 0 y la animación no corre (JS que no
 * carga, motion que falla, un navegador raro), la pantalla queda VACÍA y no hay
 * ningún error que lo explique. Acá el formulario se renderiza sin depender de
 * nada: la única animación es la del bloque de "listo", que aparece DESPUÉS de
 * una acción del usuario y por lo tanto ya sabemos que el JS corre.
 *
 * ⚠️ TRES PANTALLAS: celular, tablet y computadora (regla fija de Franco, 5/8).
 * Por eso las listas de "qué tiene" y "para qué se alquila" van en chips que
 * envuelven, y no en una fila que desborda.
 *
 * ── EL BLOQUE DE "LISTO" TIENE DOS CARAS ────────────────────────────────────
 * Alta nueva y reinscripción NO son lo mismo, y hasta el 2/9 la pantalla decía
 * "listo, ya está publicado" en los dos casos. Si el mail ya tenía ficha, la RPC
 * sólo regenera el token y descarta todo lo que se acaba de escribir (el porqué,
 * que es de seguridad, está en el header de ./actions.ts). Decirle "listo" a
 * alguien que acaba de corregir su capacidad es mentirle. Por eso el estado es
 * uno solo (`yaExistia: boolean | null`, null = todavía no mandó) y no dos
 * booleanos sueltos: molde de offer-form.tsx.
 *
 * ── LOS DOS CAMPOS QUE NO SE PUEDEN SALTEAR ─────────────────────────────────
 * Provincia y capacidad máxima. No es burocracia: son las DOS dimensiones con
 * las que se busca un salón. Un salón sin ninguna de las dos se publicaría
 * invisible, que es peor que no publicarse, porque ocupa un lugar en el
 * directorio y no recibe una sola consulta.
 */

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { LaburoWordmark } from "@/components/laburo-wordmark";
import { PROVINCIAS } from "@/lib/provincias";
import { AMENITIES_SUGERIDOS, TIPOS_EVENTO_SUGERIDOS } from "@/lib/salones";
import { registrarSalon } from "./actions";

const input =
  "w-full bg-transparent border-0 border-b border-[#4c4546] focus:border-[#e5e2e1] outline-none text-[16px] leading-[1.6] text-[#e5e2e1] py-3 px-0 rounded-none transition-colors duration-300";
const label =
  "block mb-2 font-[family-name:var(--font-geist)] text-[12px] uppercase tracking-[0.1em] text-[#cfc4c5]";
const seccion =
  "label-tech text-[11px] uppercase tracking-[0.25em] text-[#0047ff] mb-6 block";
const ayuda = "mt-3 text-[13px] text-[#8a8a8a] leading-[1.5]";

/** Un chip que se prende y se apaga. Se usa para amenities y tipos de evento. */
function Chip({
  texto,
  activo,
  onClick,
}: {
  texto: string;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`px-4 py-2.5 border text-[14px] leading-none transition-colors cursor-pointer ${
        activo
          ? "border-[#0047ff] bg-[#0047ff]/10 text-[#e5e2e1]"
          : "border-[#4c4546] text-[#988e90] hover:border-[#e5e2e1] hover:text-[#e5e2e1]"
      }`}
    >
      {texto}
    </button>
  );
}

/**
 * Un sí / no / no lo digo.
 *
 * Son TRES estados y no dos a propósito. `catering_propio` en null significa "no
 * contestó", y la ficha pública no muestra nada; si fuera un checkbox, no
 * contestar se guardaría como "no", o sea que le inventaríamos al salón la
 * respuesta que le hace perder la consulta.
 */
function TresEstados({
  titulo,
  valor,
  onChange,
  textoSi,
  textoNo,
}: {
  titulo: string;
  valor: boolean | null;
  onChange: (v: boolean | null) => void;
  textoSi: string;
  textoNo: string;
}) {
  return (
    <div>
      <span className={label}>{titulo}</span>
      <div className="flex flex-wrap gap-3">
        <Chip texto={textoSi} activo={valor === true} onClick={() => onChange(valor === true ? null : true)} />
        <Chip texto={textoNo} activo={valor === false} onClick={() => onChange(valor === false ? null : false)} />
      </div>
      <p className={ayuda}>
        Si no lo elegís, no se muestra nada. Mejor eso que decir algo que no es.
      </p>
    </div>
  );
}

export function RegistroSalonClient() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [provincia, setProvincia] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [direccion, setDireccion] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [capacidadMin, setCapacidadMin] = useState("");
  const [capacidadMax, setCapacidadMax] = useState("");
  const [superficieM2, setSuperficieM2] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [tiposEvento, setTiposEvento] = useState<string[]>([]);
  const [cateringPropio, setCateringPropio] = useState<boolean | null>(null);
  const [estacionamiento, setEstacionamiento] = useState<boolean | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null = todavía no se mandó. true/false = ya se mandó, y dice si el mail YA
  // tenía ficha (o sea, si lo que se escribió acá se guardó o se descartó).
  const [yaExistia, setYaExistia] = useState<boolean | null>(null);

  function toggle(lista: string[], set: (v: string[]) => void, valor: string) {
    set(lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    // try/finally: si el await tira, sin el finally el botón queda deshabilitado
    // para siempre y la persona no puede ni reintentar ni salir.
    try {
      const r = await registrarSalon({
        nombre,
        email,
        provincia,
        capacidadMax,
        capacidadMin,
        telefono,
        headline,
        bio,
        ciudad,
        direccion,
        website,
        instagram,
        superficieM2,
        amenities,
        tiposEvento,
        cateringPropio,
        estacionamiento,
      });
      if (r.ok) setYaExistia(!!r.yaExistia);
      else setError(r.error ?? "No se pudo. Probá de nuevo.");
    } catch {
      setError("No se pudo. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (yaExistia !== null) {
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
            {yaExistia ? (
              <>
                <p className="text-center text-[16px] leading-[1.6] text-[#cfc4c5]">
                  <span className="text-[#e5e2e1]">{nombre}</span> ya tenía su
                  ficha publicada en el directorio de salones, así que no creamos
                  nada nuevo ni te duplicamos.
                </p>
                <p className="text-center text-[16px] leading-[1.6] text-[#e5e2e1]">
                  Lo que acabás de escribir acá no se guardó. Los datos del salón
                  se editan desde tu panel, entrando con el link, que es el único
                  lugar donde sabemos que sos vos.
                </p>
                <p className="text-center text-[16px] leading-[1.6] text-[#cfc4c5]">
                  Te mandamos a <span className="text-[#e5e2e1]">{email}</span> un
                  link nuevo para entrar y corregir lo que quieras. Si no lo ves,
                  mirá en spam.
                </p>
                {/* Acá no se puede linkear /acceso-proveedor/<token>: el token
                    viaja en el mail y NO vuelve en la respuesta del action, y
                    está bien que sea así (si volviera, cualquiera que conozca un
                    mail se llevaría la llave del panel desde el navegador).
                    /mi-proveedor es la puerta que sí se puede mostrar. */}
                <Link
                  href="/mi-proveedor"
                  className="label-tech text-[12px] uppercase tracking-widest text-[#cfc4c5] hover:text-[#e5e2e1] border-b border-[#4c4546] hover:border-[#e5e2e1] pb-1 transition-colors"
                >
                  Entrar a mi panel
                </Link>
              </>
            ) : (
              <>
                <p className="text-center text-[16px] leading-[1.6] text-[#cfc4c5]">
                  Listo, <span className="text-[#e5e2e1]">{nombre}</span> ya está
                  publicado en el directorio de salones. Te mandamos a{" "}
                  <span className="text-[#e5e2e1]">{email}</span> el link para entrar
                  a tu panel. Guardá ese mail, porque el link es la forma de volver a
                  entrar. Si no lo ves, mirá en spam.
                </p>
                <Link
                  href="/salones"
                  className="label-tech text-[12px] uppercase tracking-widest text-[#cfc4c5] hover:text-[#e5e2e1] border-b border-[#4c4546] hover:border-[#e5e2e1] pb-1 transition-colors"
                >
                  Ver el directorio
                </Link>
              </>
            )}
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
          Para salones y espacios
        </p>

        <p className="text-[16px] md:text-[18px] text-[#cfc4c5] leading-[1.6] mb-12 max-w-[560px]">
          Publicá tu salón y te encuentran los que están buscando dónde hacer su
          fiesta. Estar en el directorio es gratis y no hace falta crear una
          cuenta.
        </p>

        <form onSubmit={onSubmit} className="w-full flex flex-col gap-14">
          {/* ── 01 Cuál es ────────────────────────────────────────────── */}
          <section>
            <span className={seccion}>01 // Cuál es tu salón</span>
            <div className="flex flex-col gap-8">
              <div>
                <label className={label} htmlFor="nombre">
                  Nombre del salón *
                </label>
                <input
                  id="nombre"
                  className={input}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  maxLength={200}
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
                  <p className={ayuda}>
                    Acá te mandamos el link de tu panel y las consultas.
                  </p>
                </div>
                <div>
                  <label className={label} htmlFor="telefono">
                    Teléfono o WhatsApp
                  </label>
                  <input
                    id="telefono"
                    type="tel"
                    className={input}
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    maxLength={60}
                    autoComplete="tel"
                  />
                </div>
              </div>

              <div>
                <label className={label} htmlFor="headline">
                  En una línea, qué es
                </label>
                <input
                  id="headline"
                  className={input}
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  maxLength={200}
                  placeholder="Salón con parque y quincho en zona norte"
                />
                <p className={ayuda}>
                  Es lo primero que se lee debajo del nombre, en la lista.
                </p>
              </div>

              <div>
                <label className={label} htmlFor="bio">
                  Contá cómo es
                </label>
                <textarea
                  id="bio"
                  className={`${input} resize-y`}
                  rows={5}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={2000}
                />
              </div>
            </div>
          </section>

          {/* ── 02 Cuánta gente entra ─────────────────────────────────── */}
          <section>
            <span className={seccion}>02 // Cuánta gente entra</span>
            <p className="text-[15px] text-[#988e90] leading-[1.6] mb-8 max-w-[520px]">
              Es lo primero que te van a preguntar y con lo que te van a buscar.
              Si alguien pone que son 180, le mostramos los salones donde 180
              entra.
            </p>
            <div className="flex flex-col gap-8">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                <div>
                  <label className={label} htmlFor="capmax">
                    Máximo de personas *
                  </label>
                  <input
                    id="capmax"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={100000}
                    className={input}
                    value={capacidadMax}
                    onChange={(e) => setCapacidadMax(e.target.value)}
                    required
                    placeholder="300"
                  />
                </div>
                <div>
                  <label className={label} htmlFor="capmin">
                    Mínimo de personas
                  </label>
                  <input
                    id="capmin"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={100000}
                    className={input}
                    value={capacidadMin}
                    onChange={(e) => setCapacidadMin(e.target.value)}
                    placeholder="80"
                  />
                  <p className={ayuda}>
                    Si tenés un mínimo para alquilarlo, ponelo. Así no te llegan
                    consultas de fiestas de 20 personas.
                  </p>
                </div>
                <div>
                  <label className={label} htmlFor="m2">
                    Superficie en m²
                  </label>
                  <input
                    id="m2"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={1000000}
                    className={input}
                    value={superficieM2}
                    onChange={(e) => setSuperficieM2(e.target.value)}
                    placeholder="450"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ── 03 Dónde queda ────────────────────────────────────────── */}
          <section>
            <span className={seccion}>03 // Dónde queda</span>
            <div className="flex flex-col gap-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div>
                  <label className={label} htmlFor="provincia">
                    Provincia *
                  </label>
                  <select
                    id="provincia"
                    className={`${input} appearance-none [color-scheme:dark]`}
                    value={provincia}
                    onChange={(e) => setProvincia(e.target.value)}
                    required
                  >
                    <option value="">Elegí una</option>
                    {PROVINCIAS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <p className={ayuda}>
                    Sin esto no aparecés en ninguna búsqueda por zona.
                  </p>
                </div>
                <div>
                  <label className={label} htmlFor="ciudad">
                    Ciudad o localidad
                  </label>
                  <input
                    id="ciudad"
                    className={input}
                    value={ciudad}
                    onChange={(e) => setCiudad(e.target.value)}
                    maxLength={120}
                  />
                </div>
              </div>

              <div>
                <label className={label} htmlFor="direccion">
                  Dirección
                </label>
                <input
                  id="direccion"
                  className={input}
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  maxLength={300}
                />
                <p className={ayuda}>
                  Se muestra en tu ficha. La mitad de la decisión es a qué
                  distancia queda de donde vive la gente que va a ir.
                </p>
              </div>
            </div>
          </section>

          {/* ── 04 Cómo es ────────────────────────────────────────────── */}
          <section>
            <span className={seccion}>04 // Cómo es y para qué sirve</span>
            <div className="flex flex-col gap-10">
              <div>
                <span className={label}>Para qué se alquila</span>
                <div className="flex flex-wrap gap-3">
                  {TIPOS_EVENTO_SUGERIDOS.map((t) => (
                    <Chip
                      key={t}
                      texto={t}
                      activo={tiposEvento.includes(t)}
                      onClick={() => toggle(tiposEvento, setTiposEvento, t)}
                    />
                  ))}
                </div>
                <p className={ayuda}>
                  Marcá los que van. También sirven para que te encuentren por
                  palabra: alguien que busca &quot;casamiento&quot; te va a ver.
                </p>
              </div>

              <div>
                <span className={label}>Qué tiene</span>
                <div className="flex flex-wrap gap-3">
                  {AMENITIES_SUGERIDOS.map((a) => (
                    <Chip
                      key={a}
                      texto={a}
                      activo={amenities.includes(a)}
                      onClick={() => toggle(amenities, setAmenities, a)}
                    />
                  ))}
                </div>
              </div>

              <TresEstados
                titulo="¿Se puede traer catering de afuera?"
                valor={cateringPropio}
                onChange={setCateringPropio}
                textoSi="Sí, se puede traer"
                textoNo="No, lo pone la casa"
              />

              <TresEstados
                titulo="¿Tiene estacionamiento?"
                valor={estacionamiento}
                onChange={setEstacionamiento}
                textoSi="Sí, tiene"
                textoNo="No tiene"
              />
            </div>
          </section>

          {/* ── 05 Dónde más estás ────────────────────────────────────── */}
          <section>
            <span className={seccion}>05 // Dónde más te pueden ver</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div>
                <label className={label} htmlFor="website">
                  Sitio web
                </label>
                <input
                  id="website"
                  type="url"
                  className={input}
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  maxLength={300}
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
                  maxLength={120}
                  placeholder="@tusalon"
                />
              </div>
            </div>
          </section>

          {error ? (
            <p role="alert" className="text-[15px] leading-[1.6] text-[#ff8a8a]">
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
                {loading ? "Un segundo…" : "Publicar mi salón"}
              </span>
              <ArrowRight size={18} strokeWidth={1.5} />
            </button>

            <p className="text-[13px] leading-[1.6] text-[#8a8a8a]">
              Al publicarlo, tu salón aparece en el directorio al toque. Podés
              editarlo o sacarlo cuando quieras desde el link que te mandamos por
              mail. Estar acá es gratis: cuando alguien te consulta, te llega a tu
              casilla y arreglás directo con esa persona.
            </p>

            <Link
              href="/salones"
              className="self-start label-tech text-[11px] uppercase tracking-[0.2em] text-[#988e90] hover:text-[#e5e2e1] transition-colors"
            >
              Ver el directorio de salones
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
