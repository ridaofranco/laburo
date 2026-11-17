/**
 * Origen de cada consulta (17/11/2026), igual que en somosder.ar.
 *
 * `public/origen-casa.js` guarda en la cookie propia `der_o` de dónde vino la
 * persona en su primera visita (pauta, Google, ChatGPT, directo) y avisa a
 * somosder.ar/api/origen cuando toca WhatsApp o un mail. El visitante no ve nada.
 * Lo carga `components/origen-casa.tsx`, solo en las páginas públicas.
 *
 * Los formularios NO se cuentan solos: todos validan en el navegador después de
 * tocar Enviar (mail mal escrito, campos que faltan) y el servidor puede
 * rechazarlos. Contar el intento sería anotar consultas que no existieron. Por
 * eso cada formulario lleva `data-origen="no"` y los que sí son una consulta
 * llaman a `avisarConsulta` cuando el envío salió bien.
 */

declare global {
  interface Window {
    /** La expone public/origen-casa.js. */
    derOrigen?: (canal: "whatsapp" | "mail" | "formulario", ubicacion?: string, mensaje?: string) => void;
    /** En true, el rastreador no avisa nada (aplicación con sesión). */
    derOrigenPausa?: boolean;
  }
}

/**
 * Lo que ve cualquiera sin sesión: vidriera, contenido, puertas de alta y textos
 * legales. Es una lista de lo que SÍ, a propósito: una pantalla nueva del portal
 * queda afuera sin que nadie se acuerde de sumarla.
 */
const PUBLICAS =
  /^\/(?:$|(?:para|servicios|salones|blog|en|pt|fr|it|empleos|licitaciones|registrarme|registrar-productora|registrar-proveedor|registrar-salon|sumate|privacidad|terminos)(?:\/|$))/;

export function esRutaPublica(ruta: string): boolean {
  return PUBLICAS.test(ruta);
}

/**
 * Anota una consulta enviada con éxito. `nombre` identifica el formulario en la
 * base (máximo 40 caracteres). Nunca tira: si el rastreador no cargó, no hace nada.
 */
export function avisarConsulta(nombre: string): void {
  try {
    window.derOrigen?.("formulario", nombre);
  } catch {
    // el registro de origen nunca frena un envío
  }
}
