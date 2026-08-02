"use client";

/**
 * El buscador de proveedores. Misma lógica de tarjeta que /trabajos: que se
 * pueda decidir sin abrir nada. Qué hace, dónde trabaja y desde cuánto, los tres
 * en la misma tarjeta.
 *
 * ── CÓMO SE CONTACTA, DESDE EL 2/8 ──
 * Antes esto abría WhatsApp o un `mailto:` con un saludo vacío, y el proveedor
 * tenía que preguntar todo de cero. Franco lo cambió: se abre el FORMULARIO DEL
 * PROVEEDOR (el suyo si lo armó, si no el template nuestro), la productora lo
 * completa acá adentro y al proveedor le llega la consulta entera a su mail.
 *
 * El formulario se pide recién al abrir el diálogo y no en la búsqueda: son N
 * proveedores en pantalla y a lo sumo se le escribe a uno.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog } from "@base-ui/react/dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Search, BadgeCheck, MapPin, Check, X, Send } from "lucide-react";
import { money } from "@/lib/format";
import {
  camposAMostrar,
  validarRespuestas,
  aRespuestas,
  TOPES,
  type CampoFormulario,
} from "@/lib/formulario-consulta";
import {
  consultarProveedor,
  getFormularioProveedor,
  type Proveedor,
  type FormularioProveedor,
} from "./actions";

const input =
  "w-full bg-transparent border-0 border-b border-[#4c4546] focus:border-[#e5e2e1] outline-none text-[16px] text-[#e5e2e1] py-3 px-0 rounded-none transition-colors";

const inputCaja =
  "w-full min-h-[48px] bg-[#121212] border border-[#2a2a2a] focus:border-[#e5e2e1] outline-none text-[16px] text-[#e5e2e1] px-4 py-3 rounded-none transition-colors [color-scheme:dark]";

const labelCls =
  "label-tech text-[11px] uppercase tracking-widest text-[#cfc4c5]";

/** Un campo del formulario del proveedor, renderizado según su tipo. */
function Campo({
  campo,
  valor,
  onChange,
}: {
  campo: CampoFormulario;
  valor: string;
  onChange: (v: string) => void;
}) {
  const comun = {
    id: campo.id,
    value: valor,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange(e.target.value),
    className: inputCaja,
  };

  return (
    <label className="flex flex-col gap-2" htmlFor={campo.id}>
      <span className={labelCls}>
        {campo.label}
        {campo.requerido ? <span className="text-[#e3c77f]"> *</span> : null}
      </span>

      {campo.tipo === "parrafo" ? (
        <textarea {...comun} rows={4} maxLength={TOPES.MAX_RESPUESTA} />
      ) : campo.tipo === "opciones" ? (
        <select {...comun} className={`${inputCaja} appearance-none`}>
          <option value="">Elegí una opción</option>
          {campo.opciones.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...comun}
          type={campo.tipo === "fecha" ? "date" : campo.tipo === "numero" ? "number" : "text"}
          inputMode={campo.tipo === "numero" ? "numeric" : undefined}
          maxLength={campo.tipo === "texto" ? TOPES.MAX_RESPUESTA : undefined}
        />
      )}
    </label>
  );
}

/** El diálogo de pedir presupuesto: el formulario del proveedor, completado acá. */
function DialogoConsulta({
  proveedor,
  miEmail,
  abierto,
  onClose,
  onEnviado,
}: {
  proveedor: Proveedor;
  miEmail: string;
  abierto: boolean;
  onClose: () => void;
  onEnviado: () => void;
}) {
  const reduce = useReducedMotion();
  const [form, setForm] = useState<FormularioProveedor | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState(miEmail);
  const [telefono, setTelefono] = useState("");

  // El componente se monta recién cuando la productora toca "Pedir presupuesto",
  // así que el formulario se pide una sola vez, acá. `cancelado` evita escribir
  // estado sobre un diálogo que ya se cerró (y el doble montaje de StrictMode).
  const profileId = proveedor.profile_id;
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const r = await getFormularioProveedor(profileId);
      if (cancelado) return;
      if (!r.ok) {
        toast.error(r.error);
        onClose();
        return;
      }
      setForm(r.form);
    })();
    return () => {
      cancelado = true;
    };
    // onClose es estable en la práctica (viene de un setState del padre) y no se
    // incluye a propósito: agregarlo volvería a pedir el formulario en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const campos = camposAMostrar(form?.campos);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;

    const falta = validarRespuestas(campos, valores);
    if (falta) {
      toast.error(falta);
      return;
    }
    if (!email.trim()) {
      toast.error("Poné un mail para que te pueda contestar.");
      return;
    }

    const respuestas = aRespuestas(campos, valores);
    if (respuestas.length === 0) {
      toast.error("Completá al menos una pregunta antes de mandar.");
      return;
    }

    setEnviando(true);
    const r = await consultarProveedor({
      profileId: proveedor.profile_id,
      respuestas,
      nombre,
      email,
      telefono,
    });
    setEnviando(false);

    if (!r.ok) {
      toast.error(r.error ?? "No se pudo enviar. Probá de nuevo.");
      return;
    }
    // Se le dice la verdad: si el mail no salió, la consulta igual quedó
    // guardada y alguien de SOMOS DER la ve. Un "listo" a secas sería mentira.
    if (r.mailEnviado) {
      toast.success(`Le mandamos tu consulta a ${proveedor.display_name ?? "el proveedor"}.`);
    } else {
      toast.warning(
        "Guardamos tu consulta, pero el mail no salió. La vamos a ver igual y te contactamos.",
      );
    }
    onEnviado();
    onClose();
  }

  return (
    <Dialog.Root
      open={abierto}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AnimatePresence>
        {abierto && (
          <Dialog.Portal keepMounted>
            <Dialog.Backdrop
              render={
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduce ? 0 : 0.2 }}
                  className="fixed inset-0 z-40 bg-black/70"
                />
              }
            />
            <Dialog.Popup
              render={
                <motion.div
                  initial={reduce ? { y: 0 } : { y: "100%" }}
                  animate={{ y: 0 }}
                  exit={reduce ? { y: 0 } : { y: "100%" }}
                  transition={{ type: "tween", duration: reduce ? 0 : 0.25 }}
                  className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[560px] max-h-[92vh] flex flex-col bg-[#0A0A0A] border-t border-[#1A1A1A] outline-none"
                />
              }
            >
              <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-3">
                <div className="min-w-0">
                  <Dialog.Title className="text-[22px] font-semibold text-[#e5e2e1]">
                    Pedir presupuesto
                  </Dialog.Title>
                  <p className="text-[14px] text-[#988e90] mt-1">
                    a {proveedor.display_name ?? "este proveedor"}
                  </p>
                </div>
                <Dialog.Close
                  aria-label="Cerrar"
                  className="grid place-items-center w-11 h-11 -mr-2 shrink-0 text-[#988e90] hover:text-[#e5e2e1] transition-colors"
                >
                  <X size={20} aria-hidden="true" />
                </Dialog.Close>
              </div>

              {!form ? (
                <div className="px-6 pb-8">
                  <p className="text-[15px] text-[#988e90]">Abriendo el formulario…</p>
                </div>
              ) : (
                <form onSubmit={enviar} className="flex-1 overflow-y-auto px-6 pb-8 flex flex-col gap-6">
                  {form.intro?.trim() ? (
                    <p className="text-[15px] text-[#cfc4c5] leading-[1.6] border-l-2 border-[#4c4546] pl-4">
                      {form.intro}
                    </p>
                  ) : null}

                  {campos.map((c) => (
                    <Campo
                      key={c.id}
                      campo={c}
                      valor={valores[c.id] ?? ""}
                      onChange={(v) => setValores((p) => ({ ...p, [c.id]: v }))}
                    />
                  ))}

                  <div className="flex flex-col gap-6 pt-2 border-t border-[#1A1A1A]">
                    <p className={labelCls}>Para que te conteste</p>
                    <label className="flex flex-col gap-2" htmlFor="c_nombre">
                      <span className={labelCls}>Tu nombre</span>
                      <input
                        id="c_nombre"
                        className={inputCaja}
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        maxLength={160}
                        placeholder="Quién le escribe"
                      />
                    </label>
                    <label className="flex flex-col gap-2" htmlFor="c_email">
                      <span className={labelCls}>
                        Tu mail <span className="text-[#e3c77f]">*</span>
                      </span>
                      <input
                        id="c_email"
                        type="email"
                        className={inputCaja}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </label>
                    <label className="flex flex-col gap-2" htmlFor="c_tel">
                      <span className={labelCls}>Tu teléfono (opcional)</span>
                      <input
                        id="c_tel"
                        type="tel"
                        className={inputCaja}
                        value={telefono}
                        onChange={(e) => setTelefono(e.target.value)}
                        maxLength={40}
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={enviando}
                    className="label-tech text-[12px] uppercase tracking-widest px-8 py-4 border border-[#e5e2e1] bg-[#e5e2e1] text-black hover:bg-transparent hover:text-[#e5e2e1] transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    <Send size={16} />
                    {enviando ? "Mandando…" : "Mandar la consulta"}
                  </button>
                </form>
              )}
            </Dialog.Popup>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function Tarjeta({ p, miEmail }: { p: Proveedor; miEmail: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [contactado, setContactado] = useState(p.ya_contactado);

  return (
    <div className="flex flex-col md:flex-row md:items-start justify-between gap-5 py-7 border-b border-[#1A1A1A]">
      <div className="min-w-0 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-[20px] font-semibold text-[#e5e2e1]">
            {p.display_name ?? "Sin nombre"}
          </h3>
          {p.is_verified ? (
            <span className="inline-flex items-center gap-1 label-tech text-[10px] uppercase tracking-widest text-[#7fae7f]">
              <BadgeCheck size={14} /> verificado
            </span>
          ) : null}
          {p.es_favorito ? (
            <span className="label-tech text-[10px] uppercase tracking-widest text-[#e3c77f]">
              favorito
            </span>
          ) : null}
        </div>

        {p.headline?.trim() ? (
          <p className="text-[15px] text-[#cfc4c5]">{p.headline}</p>
        ) : null}

        {(p.ciudad || p.provincia) && (
          <span className="inline-flex items-center gap-2 text-[14px] text-[#988e90]">
            <MapPin size={14} />
            {[p.ciudad, p.provincia].filter(Boolean).join(", ")}
          </span>
        )}

        <div className="flex flex-col gap-2 mt-2">
          {p.servicios.map((s, i) => (
            <div key={i} className="border-l-2 border-[#4c4546] pl-4">
              <span className="label-tech text-[11px] uppercase tracking-widest text-[#988e90]">
                {s.categoria}
              </span>
              <p className="text-[16px] text-[#e5e2e1]">{s.titulo}</p>
              {s.descripcion?.trim() ? (
                <p className="text-[14px] text-[#988e90] max-w-[520px]">{s.descripcion}</p>
              ) : null}
              <span className="text-[14px] text-[#cfc4c5]">
                {s.precio_desde != null && Number(s.precio_desde) > 0
                  ? `Desde ${money(Number(s.precio_desde))}${s.unidad ? ` / ${s.unidad}` : ""}`
                  : "Precio a consultar"}
                {s.provincias?.length ? ` • ${s.provincias.join(", ")}` : ""}
              </span>
            </div>
          ))}
        </div>

        {p.nota_interna?.trim() ? (
          <p className="text-[13px] text-[#e3c77f] mt-2">Tu nota: {p.nota_interna}</p>
        ) : null}
      </div>

      <div className="shrink-0 flex flex-col items-start md:items-end gap-2">
        {contactado ? (
          <span className="inline-flex items-center gap-2 label-tech text-[11px] uppercase tracking-widest text-[#7fae7f]">
            <Check size={14} /> Ya le consultaste
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="label-tech text-[12px] uppercase tracking-widest px-8 py-4 border border-[#e5e2e1] bg-[#e5e2e1] text-black hover:bg-transparent hover:text-[#e5e2e1] transition-colors"
        >
          Pedir presupuesto
        </button>
        {p.website?.trim() ? (
          <a
            href={p.website}
            target="_blank"
            rel="noopener noreferrer"
            className="label-tech text-[11px] uppercase tracking-widest text-[#988e90] hover:text-[#e5e2e1] transition-colors"
          >
            Ver su web
          </a>
        ) : null}
      </div>

      {abierto ? (
        <DialogoConsulta
          proveedor={p}
          miEmail={miEmail}
          abierto={abierto}
          onClose={() => setAbierto(false)}
          onEnviado={() => {
            setContactado(true);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

export function ProveedoresClient({
  proveedores,
  categorias,
  filtros,
  miEmail,
}: {
  proveedores: Proveedor[];
  categorias: string[];
  filtros: { texto: string; categoria: string; provincia: string };
  miEmail: string;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState(filtros.texto);
  const [categoria, setCategoria] = useState(filtros.categoria);
  const [provincia, setProvincia] = useState(filtros.provincia);

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (texto.trim()) p.set("q", texto.trim());
    if (categoria) p.set("cat", categoria);
    if (provincia.trim()) p.set("prov", provincia.trim());
    router.push(`/proveedores${p.toString() ? `?${p}` : ""}`);
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={buscar} className="grid grid-cols-1 md:grid-cols-4 gap-5 items-end">
        <div className="md:col-span-2">
          <label className="label-tech text-[11px] uppercase tracking-widest text-[#cfc4c5] block mb-1" htmlFor="q">
            Qué necesitás
          </label>
          <input
            id="q"
            className={input}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="sonido, catering, fotos…"
          />
        </div>
        <div>
          <label className="label-tech text-[11px] uppercase tracking-widest text-[#cfc4c5] block mb-1" htmlFor="cat">
            Categoría
          </label>
          <select
            id="cat"
            className={`${input} appearance-none`}
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="label-tech text-[11px] uppercase tracking-widest text-[#cfc4c5] block mb-1" htmlFor="prov">
              Provincia
            </label>
            <input
              id="prov"
              className={input}
              value={provincia}
              onChange={(e) => setProvincia(e.target.value)}
              placeholder="Buenos Aires"
            />
          </div>
          <button
            type="submit"
            className="shrink-0 label-tech text-[12px] uppercase tracking-widest px-6 py-4 border border-[#e5e2e1] text-[#e5e2e1] hover:bg-[#e5e2e1] hover:text-black transition-colors inline-flex items-center gap-2"
          >
            <Search size={16} /> Buscar
          </button>
        </div>
      </form>

      {proveedores.length === 0 ? (
        <div className="py-8">
          <p className="text-[17px] text-[#cfc4c5] leading-[1.6] max-w-[600px]">
            No hay proveedores publicados que coincidan. El directorio recién
            arranca: se llena a medida que los proveedores se dan de alta y
            publican lo que ofrecen.
          </p>
        </div>
      ) : (
        <div className="flex flex-col">
          {proveedores.map((p) => (
            <Tarjeta key={p.profile_id} p={p} miEmail={miEmail} />
          ))}
        </div>
      )}
    </div>
  );
}
