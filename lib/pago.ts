/**
 * CUÁNDO SE COBRA, la tercera pregunta que se hace cualquiera antes de aceptar.
 *
 * POLÍTICA DEFINIDA POR FRANCO (29/7/2026): el pago se coordina dentro de los
 * 10 días hábiles de realizado el trabajo. Es la fecha que la gente quiere ver.
 *
 * Si la política cambia, se cambia SOLO acá: este es el único lugar del sistema
 * donde vive. Lo usan la oferta (offer-actions de /staff/[id]) y el mail de
 * "Tu pago está listo" (pago-actions de /pagos). Vivía en offer-actions, pero un
 * archivo "use server" solo puede exportar funciones async, así que al segundo
 * consumidor se mudó acá.
 */
export const PAGO_TEXTO =
  "El pago se coordina con SOMOS DER dentro de los 10 días hábiles de realizado el trabajo.";

/**
 * Lo mismo, con el nombre de la productora que manda la oferta (31/10). LABURO
 * ya tiene alta de productoras, y una propuesta de otra productora le decía al
 * staff que le pagaba SOMOS DER. PAGO_TEXTO queda para las pantallas del pool
 * (sumate, panel), que son de SOMOS DER.
 */
export function pagoTexto(productora?: string | null): string {
  const quien = productora?.trim() || "la productora";
  return `El pago se coordina con ${quien} dentro de los 10 días hábiles de realizado el trabajo.`;
}
