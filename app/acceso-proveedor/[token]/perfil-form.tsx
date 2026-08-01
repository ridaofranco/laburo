"use client";

/**
 * "Mis datos": el formulario con el que el proveedor completa su propio perfil
 * (marketplace, movimiento 2). Client component, mobile-first, porque el
 * proveedor entra desde el teléfono.
 *
 * Decisiones que no son de estilo:
 *  - Los inputs son de 16px (text-body) y de 48px de alto. Menos de 16px hace
 *    que iOS haga zoom solo al enfocar el campo, y ahí se pierde el foco visual.
 *  - El email se muestra deshabilitado. Junto con el tipo es la clave única del
 *    perfil, así que cambiarlo puede chocar contra otro perfil o dejar al
 *    proveedor sin forma de que lo contacten. Se cambia avisándole a DER, y eso
 *    está escrito al lado del campo para que nadie lo busque como un bug.
 *  - No hay ningún control de verificación, ni de slug, ni de calificación: no
 *    son del proveedor y ninguna RPC por token los escribe (MKT2-03).
 *  - Si el token murió mientras la persona escribía, se refresca la pantalla en
 *    vez de mostrar un error al lado de un formulario que ya no puede guardar.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { PROVINCIAS } from "@/lib/provincias";
import { guardarPerfil } from "./actions";
import type { DatosProveedor } from "./estados";

const labelCls = "text-label font-semibold text-fg-muted";
const inputCls =
  "w-full min-h-[48px] rounded-xl bg-surface-2 border border-border text-fg text-body placeholder:text-fg-subtle px-md outline-none focus:ring-[3px] focus:ring-accent/45";

function Campo({
  label,
  ayuda,
  children,
}: {
  label: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-sm">
      <span className={labelCls}>{label}</span>
      {children}
      {ayuda && <span className="text-label text-fg-subtle">{ayuda}</span>}
    </label>
  );
}

export function PerfilForm({
  token,
  perfil,
}: {
  token: string;
  perfil: DatosProveedor;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [pending, startTransition] = useTransition();
  const [guardado, setGuardado] = useState(false);
  const [f, setF] = useState({
    display_name: perfil.display_name ?? "",
    headline: perfil.headline ?? "",
    bio: perfil.bio ?? "",
    telefono: perfil.telefono ?? "",
    website: perfil.website ?? "",
    instagram: perfil.instagram ?? "",
    ciudad: perfil.ciudad ?? "",
    provincia: perfil.provincia ?? "",
  });

  const set = <K extends keyof typeof f>(k: K, v: string) =>
    setF((p) => ({ ...p, [k]: v }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (!f.display_name.trim()) {
      toast.error("Poné el nombre con el que querés que te vean.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await guardarPerfil(token, f);
        if (res.ok) {
          setGuardado(true);
          toast.success("Listo, guardamos tus datos.");
          router.refresh();
          return;
        }
        toast.error(res.mensaje);
        // La puerta se cerró: que la pantalla entera pase a la vista sin acceso.
        if (res.terminal) router.refresh();
      } catch {
        toast.error("Algo falló. Probá de nuevo en un momento.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-md">
      <Campo label="Nombre visible" ayuda="Así te van a ver las productoras.">
        <input
          type="text"
          value={f.display_name}
          onChange={(e) => set("display_name", e.target.value)}
          placeholder="Catering La Esquina"
          maxLength={160}
          required
          className={inputCls}
        />
      </Campo>

      <Campo label="En una línea" ayuda="Qué hacés, corto y claro.">
        <input
          type="text"
          value={f.headline}
          onChange={(e) => set("headline", e.target.value)}
          placeholder="Catering para eventos corporativos"
          maxLength={200}
          className={inputCls}
        />
      </Campo>

      <Campo label="Contanos un poco más">
        <textarea
          value={f.bio}
          onChange={(e) => set("bio", e.target.value)}
          placeholder="Hace 10 años que trabajamos en eventos de 100 a 2000 personas."
          maxLength={2000}
          rows={4}
          className={`${inputCls} py-sm resize-y`}
        />
      </Campo>

      <Campo label="Teléfono" ayuda="Por acá te van a contactar.">
        <input
          type="tel"
          inputMode="tel"
          value={f.telefono}
          onChange={(e) => set("telefono", e.target.value)}
          placeholder="11 5555 5555"
          maxLength={60}
          className={inputCls}
        />
      </Campo>

      <Campo label="Mail">
        <input
          type="email"
          value={perfil.email ?? ""}
          disabled
          readOnly
          className={`${inputCls} text-fg-muted opacity-70`}
        />
        <span className="text-label text-fg-subtle">
          El mail identifica tu perfil, así que se cambia avisándole a DER.
        </span>
      </Campo>

      {/* type="text" y no type="url" a propósito: el validador nativo del
          navegador exige el esquema y por eso rechazaba "somosder.ar", que es
          como lo escribe cualquier persona. El https:// lo completa el servidor
          con normalizarWebsite. inputMode="url" se queda, que es el teclado
          correcto en el teléfono. */}
      <Campo
        label="Sitio web"
        ayuda="Podés escribirlo como te salga, nosotros lo completamos."
      >
        <input
          type="text"
          inputMode="url"
          value={f.website}
          onChange={(e) => set("website", e.target.value)}
          placeholder="tucatering.com.ar"
          maxLength={300}
          className={inputCls}
        />
      </Campo>

      <Campo label="Instagram">
        <input
          type="text"
          value={f.instagram}
          onChange={(e) => set("instagram", e.target.value)}
          placeholder="@tucatering"
          maxLength={300}
          className={inputCls}
        />
      </Campo>

      <Campo label="Ciudad">
        <input
          type="text"
          value={f.ciudad}
          onChange={(e) => set("ciudad", e.target.value)}
          placeholder="Vicente López"
          maxLength={120}
          className={inputCls}
        />
      </Campo>

      <Campo label="Provincia">
        <select
          value={f.provincia}
          onChange={(e) => set("provincia", e.target.value)}
          className={`${inputCls} appearance-none [color-scheme:dark]`}
        >
          <option value="">Elegí una provincia</option>
          {PROVINCIAS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Campo>

      <button
        type="submit"
        disabled={pending}
        className="flex items-center justify-center gap-xs min-h-[48px] rounded-none bg-fg text-surface-0 border border-fg label-tech text-[13px] px-md transition-colors hover:bg-transparent hover:text-fg disabled:opacity-60 disabled:pointer-events-none"
      >
        {pending ? "Guardando…" : "Guardar mis datos"}
      </button>

      {/* Micro interacción de confirmación (motion, preferencia global): una sola
          línea que aparece y se queda, sin robarle la pantalla al formulario. */}
      <AnimatePresence>
        {guardado && !pending && (
          <motion.p
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.28, ease: "easeOut" }}
            className="flex items-center gap-xs text-label text-positive"
          >
            <Check size={16} aria-hidden="true" />
            Tus datos quedaron guardados.
          </motion.p>
        )}
      </AnimatePresence>
    </form>
  );
}
