/**
 * Catálogo SUGERIDO de categorías de servicio para los proveedores del
 * marketplace (movimiento 2).
 *
 * Fuente: las categorías con las que SOMOS DER ya contrata proveedores para sus
 * eventos. Se escriben acá y no se importan de HITO ni de somosder-web, por la
 * misma razón que lib/oficios.ts: nada cross-repo, la app tiene que poder correr
 * sola (A5).
 *
 * IMPORTANTE, y por eso es "sugerido" y no un enum: la columna
 * staff_app.provider_services.categoria es text libre A PROPÓSITO. En HITO las
 * categorías de proveedor son configurables por productora, así que clavarlas en
 * un CHECK de la base obligaría a una migración cada vez que aparece un rubro
 * nuevo. El formulario ofrece esta lista para que el 90% de los casos sea un tap,
 * y además deja escribir la propia para el 10% restante.
 */
export const CATEGORIAS_PROVEEDOR: string[] = [
  // Sumados el 6/8 por pedido de Franco: faltaba el rubro de producción, y con
  // él la posibilidad de que una PRODUCTORA se publique como proveedora de otra
  // (subcontratación, que es como trabaja el rubro de verdad). Y los salones,
  // para que un espacio pueda publicarse hoy mismo mientras se decide si merece
  // su propio pool aparte.
  "Producción de eventos",
  "Salones y espacios",
  "Catering y gastronomía",
  "Seguridad",
  "Audiovisual",
  "Sonido",
  "Iluminación",
  "Limpieza",
  "Vallado",
  "Escenario y estructuras",
  "Generadores",
  "Baños químicos",
  "Carpas",
  "Transporte",
  "Fotografía y video",
  "Ambientación",
];

/** Unidades con las que se cotiza un servicio de evento (precio orientativo). */
export const UNIDADES_SERVICIO: string[] = [
  "por persona",
  "por jornada",
  "por evento",
  "por hora",
];
