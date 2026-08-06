/**
 * Lo compartido del pool de salones que NO es un pedido a la base.
 *
 * Vive en lib/ y no en app/salones/actions.ts por una razón del framework, no de
 * gusto: ese archivo lleva "use server", y ahí TODO lo que se exporta tiene que
 * ser una función async. Una función de formateo suelta rompe el build.
 */

/**
 * "Entran de 80 a 300" / "Entran hasta 300" / "Desde 80 personas".
 *
 * Existe una sola vez porque la capacidad se muestra en tres lugares (la fila
 * del listado, la ficha pública y el panel del salón) y es EL dato con el que la
 * persona decide si sigue mirando o cierra. Escrito tres veces, en algún momento
 * uno de los tres iba a decir otra cosa.
 */
export function textoCapacidad(
  min: number | null | undefined,
  max: number | null | undefined,
): string | null {
  if (min != null && max != null) {
    return min === max ? `Entran ${max} personas` : `Entran de ${min} a ${max} personas`;
  }
  if (max != null) return `Entran hasta ${max} personas`;
  if (min != null) return `Desde ${min} personas`;
  return null;
}

/**
 * Lo que un salón puede tener, para ofrecerlo como sugerencia al anotarse.
 *
 * Es una lista de arranque y no un catálogo cerrado: la columna es `text[]`
 * justamente porque los servicios de un salón cambian más rápido que las
 * migraciones. El que se anota puede escribir el suyo.
 */
export const AMENITIES_SUGERIDOS: string[] = [
  "Estacionamiento",
  "Aire acondicionado",
  "Calefacción",
  "Cocina equipada",
  "Vajilla",
  "Mobiliario",
  "Sonido",
  "Iluminación",
  "Pantalla o proyector",
  "WiFi",
  "Espacio al aire libre",
  "Pileta",
  "Quincho o parrilla",
  "Accesible en silla de ruedas",
  "Baños para personas con discapacidad",
  "Camarines",
  "Seguridad",
  "Generador",
];

/** Para qué se alquila. Misma lógica: sugerencias, no un menú cerrado. */
export const TIPOS_EVENTO_SUGERIDOS: string[] = [
  "Casamiento",
  "Cumpleaños de 15",
  "Cumpleaños",
  "Egresados",
  "Evento corporativo",
  "Congreso o convención",
  "Lanzamiento de producto",
  "Capacitación",
  "Show en vivo",
  "Fiesta privada",
  "Producción audiovisual",
  "Feria o expo",
];
