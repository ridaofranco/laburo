/**
 * A DÓNDE ESCRIBE ALGUIEN CUANDO ALGO NO ANDA.
 *
 * Vive en un solo archivo porque el número de WhatsApp ya estaba escrito dos
 * veces (en la landing y en la pantalla de la oferta) y esta iba a ser la
 * tercera copia. El día que cambie, cambia acá.
 *
 * ── DOS CANALES, Y NO ES INDECISIÓN ─────────────────────────────────────────
 * - **WhatsApp** para la productora: está operando un evento, muchas veces el
 *   mismo día, y necesita respuesta ahora. Es además el canal que ya usa para
 *   todo lo demás.
 * - **Mail** para el staff y los proveedores: son muchos más, escriben cosas que
 *   no son urgentes ("no me llegó el link", "quiero cambiar mi teléfono") y
 *   quedan en una casilla que se puede mirar cuando se puede.
 *
 * ⚠️ La dirección de mail está en un repo público, así que va a recibir spam.
 * Es un costo asumido: esconderla detrás de un formulario agrega una pantalla
 * que hay que mantener para ahorrar un filtro de correo.
 */

/** WhatsApp de SOMOS DER, en formato internacional sin signos. */
export const SOPORTE_WHATSAPP = "5491171540675";

/** Casilla de soporte de LABURO. */
export const SOPORTE_EMAIL = "hola@laburo.somosder.ar";

/**
 * El mensaje que va precargado en WhatsApp. Que arranque diciendo desde dónde
 * escribe ahorra la primera repregunta, que siempre es "¿de dónde me escribís?".
 */
export function soporteWhatsappMensaje(desde?: string): string {
  return desde
    ? `Hola, tengo un problema con LABURO (${desde}).`
    : "Hola, tengo un problema con LABURO.";
}

/** El asunto del mail, por el mismo motivo. */
export function soporteMailAsunto(desde?: string): string {
  return desde ? `Problema en LABURO (${desde})` : "Problema en LABURO";
}
