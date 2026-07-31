/**
 * Formas y copy de la puerta del proveedor (marketplace, movimiento 2).
 *
 * Módulo SIN directiva ("use server" / "use client"): lo importan los tres
 * mundos de esta ruta, el server component (page.tsx), el Server Action
 * (actions.ts) y los client components (perfil-form, servicios, publicar), para
 * no duplicar ni los tipos ni los textos.
 *
 * Equivale a app/o/[token]/offer-state.ts, con una diferencia importante que se
 * explica abajo en TERMINAL_COPY.
 */

/** Un servicio que presta el proveedor (fila de staff_app.provider_services). */
export interface ServicioProveedor {
  id: string;
  categoria: string;
  titulo: string;
  descripcion: string | null;
  precio_desde: number | null;
  moneda: string | null;
  unidad: string | null;
  provincias: string[];
  activo: boolean;
}

/**
 * Los datos del proveedor. `email`, `slug` e `is_verified` viajan para poder
 * mostrarlos, pero son de SOLO LECTURA: ninguna RPC por token los escribe
 * (MKT2-03, ver el comentario del SET en la migración 0042).
 */
export interface DatosProveedor {
  id: string;
  display_name: string;
  headline: string | null;
  bio: string | null;
  telefono: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  ciudad: string | null;
  provincia: string | null;
  is_public: boolean;
  is_verified: boolean;
  slug: string | null;
}

/** Lo que devuelve public.staff_app_proveedor_perfil cuando el token sirve. */
export interface PerfilProveedor {
  ok: boolean;
  perfil: DatosProveedor;
  servicios: ServicioProveedor[];
}

/**
 * Pantalla sin datos.
 *
 * HAY UNA SOLA, Y ESO ES A PROPÓSITO. La RPC devuelve SQL NULL tanto para un
 * token inventado como para uno vencido o revocado, justamente para que nadie
 * pueda averiguar si un link existió. Si acá tuviéramos dos pantallas distintas
 * estaríamos filtrando en la UI la información que la base se guarda de contar.
 *
 * El copy lo dice honesto (puede haber vencido o estar mal copiado) y, como el
 * fix de UX del 28/7 en /o/[token], tiene una salida real: un botón de WhatsApp
 * con el mensaje ya escrito para pedir un link nuevo, no un "escribinos" suelto.
 */
export const TERMINAL_COPY = {
  sin_acceso: {
    title: "Este link ya no anda",
    body: "Puede que haya vencido o que se haya copiado mal. Pedinos uno nuevo y en un minuto lo tenés.",
    wa: {
      label: "Pedir un link nuevo",
      mensaje:
        "Hola, soy proveedor y el link para completar mi perfil en LABURO no me anda. ¿Me pasan uno nuevo?",
    },
  },
} as const;

export type VistaTerminal = keyof typeof TERMINAL_COPY;

/**
 * Traducción de los códigos que devuelve staff_app_proveedor_publicar en
 * `faltan` a algo que el proveedor pueda accionar sin pensar. La RPC devuelve
 * códigos estables (no texto) para que cambiar la redacción no sea tocar la base.
 */
export const FALTA_COPY: Record<string, string> = {
  nombre: "Poné el nombre con el que querés que te vean.",
  servicios: "Agregá al menos un servicio de los que prestás.",
  provincias: "Decí en qué provincias trabajás, al menos en un servicio.",
};

/** Texto de un código de `faltan`, con un fallback honesto si aparece uno nuevo. */
export function textoFalta(codigo: string): string {
  return FALTA_COPY[codigo] ?? "Falta completar un dato del perfil.";
}
