"use client";

/**
 * Si se publica una versión nueva con un formulario abierto, la server action
 * vieja deja de existir («Failed to find Server Action») y reintentar falla
 * siempre: la persona queda trabada en «Probá de nuevo» y pierde lo escrito.
 *
 * Estas dos piezas resuelven eso igual en todos los formularios de alta:
 * - guardarYRecargar(clave, datos): en el catch del envío. Guarda lo cargado
 *   en sessionStorage y recarga UNA vez (nunca entra en un bucle). Devuelve
 *   true si recargó (el que llama hace return) y false si ya había recargado.
 * - useRecuperarGuardado(clave, aplicar): al montar, devuelve lo guardado,
 *   lo borra y avisa con un toast que hay que tocar Enviar de nuevo.
 *
 * El primer caso fue /sumate camino rápido (5fa1d63, registro-rapido.tsx).
 */

import { useEffect, useRef } from "react";
import { toast } from "sonner";

const PREFIJO = "laburo-pendiente:";
const RECARGADO = "laburo-recargado:";

export function guardarYRecargar(clave: string, datos: unknown): boolean {
  try {
    if (sessionStorage.getItem(RECARGADO + clave) !== null) return false;
    sessionStorage.setItem(RECARGADO + clave, "1");
    sessionStorage.setItem(PREFIJO + clave, JSON.stringify(datos));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

export function useRecuperarGuardado<T>(clave: string, aplicar: (g: T) => void) {
  // aplicar cambia en cada render; se usa la última sin volver a correr el efecto.
  const ref = useRef(aplicar);
  ref.current = aplicar;
  useEffect(() => {
    let g: T | null = null;
    try {
      const crudo = sessionStorage.getItem(PREFIJO + clave);
      sessionStorage.removeItem(PREFIJO + clave);
      if (crudo) g = JSON.parse(crudo) as T;
    } catch {
      return;
    }
    if (!g) return;
    ref.current(g);
    // Con un respiro: recién montada la página, el contenedor de avisos todavía
    // no está escuchando y el aviso se perdía.
    setTimeout(
      () => toast("Actualizamos la página mientras completabas. Tus datos siguen acá: tocá Enviar de nuevo."),
      600,
    );
  }, [clave]);
}

/** ¿Hay algo guardado para esta clave? (sin borrarlo). Para abrir la pantalla correcta. */
export function hayGuardado(clave: string): boolean {
  try {
    return sessionStorage.getItem(PREFIJO + clave) !== null;
  } catch {
    return false;
  }
}
