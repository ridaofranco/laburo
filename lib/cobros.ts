/**
 * SI LABURO COBRA O NO, que hoy es que NO.
 *
 * DECISIÓN DE FRANCO (2/9/2026, definitiva desde el 31/10/2026): LABURO no
 * cobra entre partes. Es una decisión legal y de producto, no una limitación
 * técnica: el circuito de MercadoPago (checkout, webhook, verificación
 * de monto, registro del pago) está entero, funciona y no se borró ni una línea.
 * Se apaga acá y se prende acá.
 *
 * Por qué vive en su propio archivo y no adentro de payment-actions.ts: ese
 * archivo es "use server" y un archivo "use server" solo puede exportar funciones
 * async, así que una constante no entra. Es el mismo problema que ya resolvió
 * lib/pago.ts con PAGO_TEXTO. Y además gig-board.tsx es un componente cliente y
 * necesita leer la bandera para no ofrecer el botón.
 *
 * NO SE REVIERTE (Franco 31/10: LABURO no cobra entre partes). Lo de abajo
 * queda solo como registro de cómo estaba armado:
 * 1. Era poner COBRO_AL_CLIENTE_ACTIVO en true.
 * 2. Repasar COBROS.md, que lista las tres piezas que además faltan
 *    (MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, y verificar que el token no sea TEST-).
 * Nada más: no hay sistema de feature flags acá, es una constante booleana y un
 * string. Si esto cambia, se cambia SOLO en este archivo.
 */

/**
 * Franco 31/10: LABURO no cobra entre partes. Ni comisión, ni presupuesto del
 * evento, ni nada que pase plata de una parte a la otra. Es DEFINITIVO, no
 * «por ahora»: LABURO es un portal de ofertas y perfiles, no intermediario
 * (trabajo/laburo-legal/PLAN-CAMBIO-LABURO.md, fase 1). El tipo literal `false`
 * hace que prenderlo exija cambiar este archivo a propósito. Los datos de
 * cobros viejos quedan guardados, no se borra nada.
 */
export const COBRO_AL_CLIENTE_ACTIVO = false as const;

/**
 * Lo que ve la productora si igual llega a disparar el cobro. Pasa: una server
 * action es un endpoint POST invocable, esconder el botón no alcanza.
 */
export const COBRO_APAGADO_MOTIVO =
  "LABURO no cobra entre partes: no maneja plata entre quien publica y quien trabaja. Los pagos se arreglan directo entre ustedes.";
