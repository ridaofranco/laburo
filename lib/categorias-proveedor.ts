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
/**
 * ── DE DÓNDE SALEN ESTOS RUBROS (6/8, segunda tanda) ─────────────────────────
 * Franco: *"ya te dije que le faltaban rubros a los proveedores"*. Los que se
 * sumaron NO se inventaron: salen de cruzar la lista contra los rubros que DER
 * ya usa en sus presupuestos reales (`budget_items.category`). El agujero más
 * grande era el más obvio en cuanto se miran los datos: **BOOKING era el rubro
 * con MÁS renglones de todos los presupuestos (33) y no existía acá**, o sea
 * que un artista o un DJ no tenía dónde publicarse. Detrás venía ARTE (25),
 * que tampoco estaba.
 *
 * También estaban afuera Marketing, Prensa, Seguros, Salud, Señalética y
 * Logística, todos con renglones reales facturados.
 */
export const CATEGORIAS_PROVEEDOR: string[] = [
  // Sumados el 6/8 por pedido de Franco: faltaba el rubro de producción, y con
  // él la posibilidad de que una PRODUCTORA se publique como proveedora de otra
  // (subcontratación, que es como trabaja el rubro de verdad). Y los salones,
  // para que un espacio pueda publicarse hoy mismo mientras se decide si merece
  // su propio pool aparte.
  "Producción de eventos",
  "Salones y espacios",

  // Artístico. BOOKING es el rubro con más renglones en los presupuestos de DER
  // y no tenía dónde publicarse.
  "Artistas y shows",
  "DJ y música",
  "Entretenimiento y animación",

  // Técnica
  "Sonido",
  "Iluminación",
  "Audiovisual",
  "Pantallas LED",
  "Escenario y estructuras",
  "Generadores y energía",
  "Rigging",

  // Arte y ambientación. ARTE es el segundo rubro con más renglones.
  "Escenografía y arte",
  "Ambientación",
  "Flores y decoración",

  // Gastronomía
  "Catering y gastronomía",
  "Barras y bebidas",
  "Food trucks",
  "Vajilla y mantelería",

  // Infraestructura
  "Mobiliario",
  "Carpas",
  "Vallado",
  "Baños químicos",
  "Climatización",

  // Operación
  "Seguridad",
  "Servicio médico y emergencias",
  "Limpieza",
  "Transporte y logística",
  "Acreditación y control de acceso",

  // Comunicación
  "Fotografía y video",
  "Streaming y transmisión",
  "Gráfica, señalética y branding",
  "Marketing y comunicación",
  "Prensa y difusión",
  "Merchandising y regalos",

  // Administrativo
  "Seguros",
  "Higiene y seguridad",
];

/** Unidades con las que se cotiza un servicio de evento (precio orientativo). */
export const UNIDADES_SERVICIO: string[] = [
  "por persona",
  "por jornada",
  "por evento",
  "por hora",
];
