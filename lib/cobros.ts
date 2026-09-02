/**
 * SI LABURO COBRA O NO, que hoy es que NO.
 *
 * DECISIÓN DE PRODUCTO DE FRANCO (2/9/2026): LABURO es GRATIS para todos por
 * ahora. No cobra comisión ni acceso. Es una decisión comercial, no una
 * limitación técnica: el circuito de MercadoPago (checkout, webhook, verificación
 * de monto, registro del pago) está entero, funciona y no se borró ni una línea.
 * Se apaga acá y se prende acá.
 *
 * Por qué vive en su propio archivo y no adentro de payment-actions.ts: ese
 * archivo es "use server" y un archivo "use server" solo puede exportar funciones
 * async, así que una constante no entra. Es el mismo problema que ya resolvió
 * lib/pago.ts con PAGO_TEXTO. Y además gig-board.tsx es un componente cliente y
 * necesita leer la bandera para no ofrecer el botón.
 *
 * CÓMO SE REVIERTE el día que se decida cobrar:
 * 1. Poner COBRO_AL_CLIENTE_ACTIVO en true.
 * 2. Repasar COBROS.md, que lista las tres piezas que además faltan
 *    (MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, y verificar que el token no sea TEST-).
 * Nada más: no hay sistema de feature flags acá, es una constante booleana y un
 * string. Si esto cambia, se cambia SOLO en este archivo.
 */

/** ¿LABURO le cobra al cliente? Hoy no: es gratis por decisión de producto. */
export const COBRO_AL_CLIENTE_ACTIVO = false;

/**
 * Lo que ve la productora si igual llega a disparar el cobro. Pasa: una server
 * action es un endpoint POST invocable, esconder el botón no alcanza.
 */
export const COBRO_APAGADO_MOTIVO =
  "LABURO es gratis por ahora: no cobramos comisión ni acceso, así que el cobro al cliente está apagado.";
