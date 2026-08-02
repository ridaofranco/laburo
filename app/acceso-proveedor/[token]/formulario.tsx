"use client";

/**
 * "Cómo quiero que me consulten": el formulario que completa la productora (y
 * mañana el cliente final) cuando le pide un presupuesto a este proveedor.
 *
 * ── LA DECISIÓN DE PRODUCTO ──
 * Franco (2/8): el formulario "lo pueden armar ellos si quieren o pueden usar un
 * template nuestro". Las dos mitades de esa frase están en la pantalla:
 *
 *  · ARRANCA CON EL TEMPLATE YA PUESTO Y FUNCIONANDO. El proveedor entró a
 *    conseguir clientes, no a configurar. Si no toca nada, igual recibe
 *    consultas completas desde el minuto cero. Por eso el estado inicial no es
 *    una pantalla vacía que diga "creá tu primer campo", que es la forma clásica
 *    de que nadie lo use nunca.
 *
 *  · ARMAR EL PROPIO ES UN BOTÓN, NO UN REQUISITO. Al tocarlo, las preguntas del
 *    template se copian como punto de partida en vez de dejarlo en blanco:
 *    editar seis preguntas que ya dicen algo es mucho más fácil que inventarlas.
 *
 *  · SE PUEDE VOLVER. "Volver al formulario de SOMOS DER" manda un array vacío,
 *    que es exactamente lo que la base entiende como "usá el template". Sin esa
 *    salida, tocar el botón una vez sería irreversible.
 *
 * ── POR QUÉ NO HAY DRAG AND DROP ──
 * Se ordena con flechas arriba/abajo. El proveedor está en el teléfono y el
 * drag and drop en móvil pelea con el scroll de la pantalla. Dos botones de 44px
 * hacen lo mismo sin pelearse con nada.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, ChevronUp, ChevronDown, RotateCcw } from "lucide-react";
import {
  TEMPLATE_CONSULTA,
  NOMBRE_TIPO,
  TOPES,
  campoNuevo,
  usaTemplate,
  validarCampos,
  type CampoFormulario,
  type TipoCampo,
} from "@/lib/formulario-consulta";
import { guardarFormulario } from "./actions";

const labelCls = "text-label font-semibold text-fg-muted";
const inputCls =
  "w-full min-h-[48px] rounded-xl bg-surface-2 border border-border text-fg text-body placeholder:text-fg-subtle px-md outline-none focus:ring-[3px] focus:ring-accent/45";

const TIPOS: TipoCampo[] = ["texto", "parrafo", "numero", "fecha", "opciones"];

/** Cómo se ve una pregunta del lado de quien la responde. Sin interacción: es
 *  una muestra, no el formulario de verdad. */
function Vista({ campo }: { campo: CampoFormulario }) {
  return (
    <div className="flex flex-col gap-xs">
      <span className="text-label text-fg-muted">
        {campo.label}
        {campo.requerido ? <span className="text-accent"> *</span> : null}
      </span>
      <div className="min-h-[44px] rounded-xl bg-surface-2 border border-border px-md flex items-center">
        <span className="text-body text-fg-subtle">
          {campo.tipo === "opciones"
            ? campo.opciones.filter(Boolean).join(" · ") || "Sin opciones todavía"
            : NOMBRE_TIPO[campo.tipo]}
        </span>
      </div>
    </div>
  );
}

/** Una pregunta en modo edición. */
function Editor({
  campo,
  primero,
  ultimo,
  onChange,
  onBorrar,
  onSubir,
  onBajar,
}: {
  campo: CampoFormulario;
  primero: boolean;
  ultimo: boolean;
  onChange: (c: CampoFormulario) => void;
  onBorrar: () => void;
  onSubir: () => void;
  onBajar: () => void;
}) {
  const flecha =
    "grid place-items-center w-11 h-11 rounded-xl border border-border text-fg-muted disabled:opacity-30";

  return (
    <div className="flex flex-col gap-md rounded-xl bg-surface-2 border border-border p-md">
      <div className="flex items-start gap-sm">
        <label className="flex-1 flex flex-col gap-xs">
          <span className={labelCls}>La pregunta</span>
          <input
            className={inputCls}
            value={campo.label}
            maxLength={TOPES.MAX_LABEL}
            placeholder="¿Para cuántas personas?"
            onChange={(e) => onChange({ ...campo, label: e.target.value })}
          />
        </label>
        <div className="flex flex-col gap-xs pt-[26px]">
          <button type="button" onClick={onSubir} disabled={primero} className={flecha} aria-label="Subir">
            <ChevronUp size={18} aria-hidden="true" />
          </button>
          <button type="button" onClick={onBajar} disabled={ultimo} className={flecha} aria-label="Bajar">
            <ChevronDown size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <label className="flex flex-col gap-xs">
        <span className={labelCls}>Cómo se responde</span>
        <select
          className={`${inputCls} appearance-none [color-scheme:dark]`}
          value={campo.tipo}
          onChange={(e) => {
            const tipo = e.target.value as TipoCampo;
            onChange({
              ...campo,
              tipo,
              // Al pasar a "elegir de una lista" se arranca con dos renglones
              // vacíos, porque una lista de una sola opción no es una lista y la
              // base la rechaza. Al salir, las opciones se limpian.
              opciones: tipo === "opciones" ? (campo.opciones.length ? campo.opciones : ["", ""]) : [],
            });
          }}
        >
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {NOMBRE_TIPO[t]}
            </option>
          ))}
        </select>
      </label>

      {campo.tipo === "opciones" ? (
        <div className="flex flex-col gap-sm">
          <span className={labelCls}>Las opciones</span>
          {campo.opciones.map((o, i) => (
            <div key={i} className="flex items-center gap-sm">
              <input
                className={inputCls}
                value={o}
                maxLength={TOPES.MAX_LARGO_OPCION}
                placeholder={`Opción ${i + 1}`}
                onChange={(e) => {
                  const ops = [...campo.opciones];
                  ops[i] = e.target.value;
                  onChange({ ...campo, opciones: ops });
                }}
              />
              <button
                type="button"
                aria-label={`Borrar opción ${i + 1}`}
                onClick={() =>
                  onChange({ ...campo, opciones: campo.opciones.filter((_, j) => j !== i) })
                }
                className="grid place-items-center w-11 h-11 shrink-0 rounded-xl border border-border text-fg-muted"
              >
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </div>
          ))}
          {campo.opciones.length < TOPES.MAX_OPCIONES ? (
            <button
              type="button"
              onClick={() => onChange({ ...campo, opciones: [...campo.opciones, ""] })}
              className="self-start text-label font-semibold text-accent min-h-[44px]"
            >
              + Agregar opción
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-md pt-xs">
        <label className="flex items-center gap-sm min-h-[44px]">
          <input
            type="checkbox"
            checked={campo.requerido}
            onChange={(e) => onChange({ ...campo, requerido: e.target.checked })}
            className="w-5 h-5 accent-accent"
          />
          <span className="text-label text-fg">Es obligatoria</span>
        </label>
        <button
          type="button"
          onClick={onBorrar}
          className="inline-flex items-center gap-xs min-h-[44px] text-label font-semibold text-destructive px-sm"
        >
          <Trash2 size={16} aria-hidden="true" /> Borrar
        </button>
      </div>
    </div>
  );
}

export function Formulario({
  token,
  camposIniciales,
  introInicial,
}: {
  token: string;
  camposIniciales: CampoFormulario[];
  introInicial: string | null;
}) {
  const router = useRouter();
  const [guardando, startGuardar] = useTransition();

  // `editando` es "armé el mío". Arranca en true solo si ya lo había armado.
  const [editando, setEditando] = useState(!usaTemplate(camposIniciales));
  const [campos, setCampos] = useState<CampoFormulario[]>(camposIniciales);
  const [intro, setIntro] = useState(introInicial ?? "");

  const enTemplate = usaTemplate(campos) && !editando;
  const visibles = enTemplate ? TEMPLATE_CONSULTA : campos;

  function mover(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= campos.length) return;
    const copia = [...campos];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    setCampos(copia);
  }

  function armarElMio() {
    // Se parte del template, no de una hoja en blanco. Los ids se regeneran para
    // que sean suyos y no queden atados a los del template.
    setCampos(TEMPLATE_CONSULTA.map((c) => ({ ...c, id: campoNuevo().id, opciones: [...c.opciones] })));
    setEditando(true);
  }

  function guardar(nuevos: CampoFormulario[], mensaje: string) {
    const error = validarCampos(nuevos);
    if (error) {
      toast.error(error);
      return;
    }
    startGuardar(async () => {
      // Se limpian los espacios y las opciones vacías recién acá: mientras
      // escribe, un renglón vacío tiene que poder existir.
      const limpios = nuevos.map((c) => ({
        ...c,
        label: c.label.trim(),
        opciones: c.tipo === "opciones" ? c.opciones.map((o) => o.trim()).filter(Boolean) : [],
      }));
      const r = await guardarFormulario(token, limpios, intro);
      if (!r.ok) {
        toast.error(r.mensaje);
        if (r.terminal) router.refresh();
        return;
      }
      toast.success(mensaje);
      router.refresh();
    });
  }

  function volverAlTemplate() {
    setCampos([]);
    setEditando(false);
    startGuardar(async () => {
      const r = await guardarFormulario(token, [], intro);
      if (!r.ok) {
        toast.error(r.mensaje);
        return;
      }
      toast.success("Volviste al formulario de SOMOS DER.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-lg">
      {enTemplate ? (
        <>
          <p className="text-label text-fg-subtle">
            Estas son las preguntas que le hacemos por vos a quien te quiera
            contratar. Con esto ya podés cotizar sin tener que repreguntar nada.
          </p>
          <div className="flex flex-col gap-md">
            {visibles.map((c) => (
              <Vista key={c.id} campo={c} />
            ))}
          </div>
          <button
            type="button"
            onClick={armarElMio}
            className="min-h-[48px] rounded-xl border border-border text-fg text-label font-semibold px-lg"
          >
            Quiero armar el mío
          </button>
        </>
      ) : (
        <>
          <p className="text-label text-fg-subtle">
            Preguntá lo que necesites para poder cotizar. Cuantas menos preguntas
            pongas, más gente termina de completarlo.
          </p>

          <div className="flex flex-col gap-md">
            {campos.map((c, i) => (
              <Editor
                key={c.id}
                campo={c}
                primero={i === 0}
                ultimo={i === campos.length - 1}
                onChange={(nuevo) => setCampos(campos.map((x, j) => (j === i ? nuevo : x)))}
                onBorrar={() => setCampos(campos.filter((_, j) => j !== i))}
                onSubir={() => mover(i, -1)}
                onBajar={() => mover(i, 1)}
              />
            ))}
          </div>

          {campos.length < TOPES.MAX_CAMPOS ? (
            <button
              type="button"
              onClick={() => setCampos([...campos, campoNuevo()])}
              className="inline-flex items-center justify-center gap-sm min-h-[48px] rounded-xl border border-border text-fg text-label font-semibold px-lg"
            >
              <Plus size={18} aria-hidden="true" /> Agregar una pregunta
            </button>
          ) : (
            <p className="text-label text-fg-subtle">
              Llegaste al máximo de {TOPES.MAX_CAMPOS} preguntas.
            </p>
          )}

          <label className="flex flex-col gap-xs">
            <span className={labelCls}>Algo que quieras aclarar antes (opcional)</span>
            <textarea
              className={`${inputCls} min-h-[96px] py-sm`}
              value={intro}
              maxLength={TOPES.MAX_INTRO}
              placeholder="Respondo dentro de las 24hs. No cubro zona sur."
              onChange={(e) => setIntro(e.target.value)}
            />
          </label>

          <div className="flex flex-col gap-sm">
            <button
              type="button"
              disabled={guardando || campos.length === 0}
              onClick={() => guardar(campos, "Guardamos tu formulario.")}
              className="flex items-center justify-center gap-xs min-h-[48px] rounded-none bg-fg text-surface-0 border border-fg label-tech text-[13px] px-md transition-colors hover:bg-transparent hover:text-fg disabled:opacity-60 disabled:pointer-events-none"
            >
              {guardando ? "Guardando…" : "Guardar mi formulario"}
            </button>
            <button
              type="button"
              disabled={guardando}
              onClick={volverAlTemplate}
              className="inline-flex items-center justify-center gap-sm min-h-[48px] text-label font-semibold text-fg-muted disabled:opacity-50"
            >
              <RotateCcw size={16} aria-hidden="true" /> Volver al formulario de SOMOS DER
            </button>
          </div>
        </>
      )}
    </div>
  );
}
