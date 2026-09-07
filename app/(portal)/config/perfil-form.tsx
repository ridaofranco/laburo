"use client";

/**
 * La tarjeta del perfil de la agencia: se mira y se edita en el mismo lugar.
 *
 * ⚠️ ARRANCA EN MODO LECTURA, a propósito. Ajustes es una pantalla que se abre
 * para mirar (¿cuántos hay en el pool?, ¿quién está en el equipo?), no para
 * escribir: si el formulario está siempre abierto, cualquier clic distraído
 * cambia el perfil que sale en las ofertas. El botón "Editar" es el que declara
 * la intención.
 *
 * Y si el que mira no puede escribir (rol `viewer`), no hay botón: la RPC ya lo
 * rechaza del lado de la base, pero ofrecer algo que va a fallar es peor que no
 * ofrecerlo.
 */

import { useState, useTransition } from "react";
import { Building2, Pencil, X } from "lucide-react";
import { guardarPerfil, type PerfilOrg } from "./perfil-actions";

const LABEL =
  "label-tech text-[11px] text-[#cfc4c5] uppercase tracking-[0.1em] mb-2 block";
const INPUT =
  "w-full bg-transparent border-0 border-b border-[#4c4546] focus:border-[#e5e2e1] outline-none text-[18px] leading-[1.6] text-[#e5e2e1] py-2 px-0 rounded-none transition-colors duration-300";
const VALOR = "text-[18px] leading-[1.6] text-[#e5e2e1] border-b border-[#4c4546] pb-2";

/** Un dato vacío se dice, no se disimula con un guión suelto. */
function Vacio({ children }: { children: React.ReactNode }) {
  return <span className="text-[#8a8a8a] italic">{children}</span>;
}

export function PerfilForm({
  perfil,
  sigla,
}: {
  perfil: PerfilOrg;
  sigla: string;
}) {
  const [datos, setDatos] = useState(perfil);
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [pendiente, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const r = await guardarPerfil(fd);
      if (r.ok) {
        // ⚠️ `puede_editar` NO VIENE EN LA RESPUESTA DEL GUARDADO, y hay que
        // conservarlo a mano. La RPC de guardar devuelve la organización (los
        // datos), no el permiso del que la miró: pisando el estado con eso, la
        // tarjeta volvía a decir "Solo lectura" justo después de una edición
        // exitosa. Se vio en la prueba, no en el código.
        setDatos({ ...r.perfil, puede_editar: datos.puede_editar });
        setEditando(false);
        setGuardado(true);
        setTimeout(() => setGuardado(false), 4000);
      } else {
        setError(r.error);
      }
    });
  }

  const ubicacion =
    [datos.ciudad, datos.provincia, datos.pais].filter(Boolean).join(", ") || null;

  return (
    <div className="border border-[#1A1A1A] bg-[#0A0A0A] p-6 lg:p-10">
      <div className="flex items-center justify-between mb-8 pb-2 border-b border-[#1A1A1A] gap-4">
        <h3 className="t-section text-[#e5e2e1] flex items-center gap-3">
          <Building2 size={24} className="shrink-0" />
          Perfil de la agencia
        </h3>

        {datos.puede_editar ? (
          <button
            type="button"
            onClick={() => {
              setEditando((v) => !v);
              setError(null);
            }}
            className="shrink-0 whitespace-nowrap label-tech text-[11px] text-[#cfc4c5] uppercase tracking-[0.1em] border border-[#4c4546] px-3 py-2 hover:border-[#e5e2e1] hover:text-[#e5e2e1] transition-colors flex items-center gap-2"
          >
            {editando ? <><X size={13} /> Cancelar</> : <><Pencil size={13} /> Editar</>}
          </button>
        ) : (
          <span className="shrink-0 whitespace-nowrap label-tech text-[11px] text-[#cfc4c5] uppercase tracking-[0.1em] border border-[#4c4546] px-3 py-2">
            Solo lectura
          </span>
        )}
      </div>

      {guardado ? (
        <p className="mb-6 text-[14px] text-[#3dd68c]">Listo, se guardó.</p>
      ) : null}

      <div className="flex flex-col md:flex-row gap-6 md:gap-12 items-start">
        {/* Monograma. Es el fallback correcto mientras no haya logo propio:
            las iniciales de la productora, no un hueco. */}
        <div className="w-32 h-32 shrink-0 border border-[#4c4546] grid place-items-center bg-[#131313]">
          <span className="t-stat-sm text-[#e5e2e1]">{sigla}</span>
        </div>

        <div className="flex-1 w-full min-w-0">
          {editando ? (
            <form onSubmit={onSubmit} className="flex flex-col gap-6">
              <div>
                <label className={LABEL} htmlFor="descripcion">
                  Qué hace
                </label>
                <textarea
                  id="descripcion"
                  name="descripcion"
                  rows={3}
                  maxLength={600}
                  defaultValue={datos.descripcion ?? ""}
                  placeholder="Producción integral de eventos corporativos y fiestas privadas en CABA."
                  className={`${INPUT} resize-y placeholder:text-[#565656]`}
                />
                <p className="mt-2 text-[13px] text-[#8a8a8a]">
                  Máximo 600 caracteres. Es lo que te describe como productora.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <label className={LABEL} htmlFor="ciudad">Ciudad</label>
                  <input id="ciudad" name="ciudad" maxLength={80} defaultValue={datos.ciudad ?? ""} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL} htmlFor="provincia">Provincia</label>
                  <input id="provincia" name="provincia" maxLength={80} defaultValue={datos.provincia ?? ""} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL} htmlFor="pais">País</label>
                  <input id="pais" name="pais" maxLength={80} defaultValue={datos.pais ?? ""} className={INPUT} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <label className={LABEL} htmlFor="web">Web</label>
                  <input id="web" name="web" maxLength={200} defaultValue={datos.web ?? ""} placeholder="tuproductora.com" className={`${INPUT} placeholder:text-[#565656]`} />
                </div>
                <div>
                  <label className={LABEL} htmlFor="instagram">Instagram</label>
                  <input id="instagram" name="instagram" maxLength={80} defaultValue={datos.instagram ?? ""} placeholder="tuproductora" className={`${INPUT} placeholder:text-[#565656]`} />
                </div>
                <div>
                  <label className={LABEL} htmlFor="telefono">Teléfono</label>
                  <input id="telefono" name="telefono" maxLength={60} defaultValue={datos.telefono ?? ""} className={INPUT} />
                </div>
              </div>

              {error ? (
                <p role="alert" className="text-[14px] leading-[1.5] text-[#ff8a8a]">{error}</p>
              ) : null}

              <button
                type="submit"
                disabled={pendiente}
                className="self-start bg-[#f5f5f5] text-black label-tech text-[12px] uppercase tracking-[0.1em] py-3 px-8 hover:bg-[#0047ff] hover:text-white transition-colors disabled:opacity-50"
              >
                {pendiente ? "Guardando..." : "Guardar cambios"}
              </button>
            </form>
          ) : (
            <div className="flex flex-col gap-8">
              <div>
                <p className={LABEL}>Nombre de la agencia</p>
                <p className={VALOR}>{datos.name}</p>
              </div>
              <div>
                <p className={LABEL}>Qué hace</p>
                <p className={VALOR}>
                  {datos.descripcion ?? (
                    <Vacio>
                      Todavía no lo escribiste. Contá a qué se dedica tu
                      productora.
                    </Vacio>
                  )}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-8">
                <div className="flex-1 min-w-0">
                  <p className={LABEL}>Ubicación</p>
                  <p className={`${VALOR} truncate`}>
                    {ubicacion ?? <Vacio>Sin cargar</Vacio>}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={LABEL}>Contacto</p>
                  <p className={`${VALOR} truncate`}>
                    {datos.web || datos.instagram || datos.telefono ? (
                      [
                        datos.web?.replace(/^https?:\/\//, ""),
                        datos.instagram ? `@${datos.instagram}` : null,
                        datos.telefono,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    ) : (
                      <Vacio>Sin cargar</Vacio>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
