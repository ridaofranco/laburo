# Manual de la revista de LABURO

Lo usa el turno noche C (lunes, miércoles y viernes) para escribir notas del blog de LABURO (`content/blog/*.md`). Arrancó el 28/10/2026 con 16 notas.
Es la versión LABURO del manual de la revista de somosder-web. **No se toca `editorial/` ni el blog de somosder-web**: esto es solo de LABURO.

## Para quién escribimos
Cuatro lectores, los mismos cuatro caminos de la home:
1. **Quien contrata** (productora, agencia, marca, empresa): quiere saber cuánta gente, qué perfil, cuánto sale, cómo no fallar.
2. **Quien trabaja en eventos**: quiere entrar, conseguir más fechas, saber cómo se cobra y qué le piden.
3. **Proveedores** (sonido, catering, estructuras, seguridad): quieren que los encuentren y les pidan precio.
4. **Salones**: quieren que los encuentren por capacidad y zona.

## Pilares (rotar entre ellos)
- **Dimensionar y armar el equipo** (contrata).
- **Oficios por dentro**: qué hace cada puesto y qué le piden (trabaja).
- **Papeles y normas**: carnet de manipulador, contrato eventual, admisión y permanencia, seguridad privada. Solo con fuente oficial.
- **Proveedores y salones**: cómo pedir precio, cómo comparar, cómo elegir.
- **Temporadas**: fin de año, verano, congresos de marzo a noviembre. Publicar un mes antes.

## Reglas duras
- Castellano rioplatense con voseo. Concreto, útil, sin relleno ni frases de marketing.
- **Nunca guion largo (—) ni semiguion (–).** Paréntesis, comas o dos puntos.
- Solo funciones de LABURO que existen: verificarlas en el código antes de nombrarlas (`app/`, `lib/`). Lo que la home dice es lo único que se afirma del negocio (+1.100 postulantes, +100 eventos, +150.000 asistentes, 6 países, gratis).
- **No afirmar** comisiones, pagos dentro de la app, seguros, ART, plazos de cobro de terceros, verificación de antecedentes ni cantidad de proveedores o salones publicados. «El pago en 10 días hábiles» vale solo cuando contrata SOMOS DER: no generalizar.
- Datos del mundo (leyes, montos, tarifas): solo con fuente oficial que se haya abierto, y lista «Fuentes» al pie. Sin fuente, afuera. Nunca tarifas de mercado inventadas.
- No nombrar clientes de DER (ver memoria de clientes que no se nombran). Sin testimonios ni casos inventados.
- 800 a 1.200 palabras, `##` para subtítulos, 4 o 5 FAQ en el frontmatter (respuestas de 2 a 4 oraciones que se entiendan solas: son las que citan Google y las IA).

## Plantilla del frontmatter
Copiar el de cualquier nota de `content/blog/`: title, description (140 a 160 caracteres), metaTitle (hasta ~60, termina en «| LABURO»), slug (= nombre del archivo), canonical `https://laburo.somosder.ar/blog/<slug>`, kicker, date, readingTime, order (el siguiente libre), lang: es, faqs. Sin `audiencia` (eso es solo de `content/para/`).

## Enlaces
- Cada nota enlaza al menos a una página `/para/<slug>` y a una nota del blog, y termina con el camino que corresponde (`/sumate`, `/registrar-productora`, `/servicios`, `/salones`).
- Al publicar una nota, sumarla en `PARA_POR_NOTA` de `lib/para.ts` (bloque «Para tu caso» al pie de la nota).

## Antes de publicar
1. Validar: `yaml.safe_load` del frontmatter, 0 guiones largos, enlaces internos que existan.
2. `npx tsc --noEmit`, eslint de `app` y `lib`, `next build`.
3. Probar a 320, 390 y 1366 px (tablas y URLs largas ya tienen arreglo en `globals.css`).
4. Publicar, verificar 200 en producción, que esté en `/sitemap.xml` y `/llms.txt`, y mandar a IndexNow (clave en `public/94763d2734274822aec29fcd0449c819.txt`).

## Publicadas el 28/10 (no repetir)
Ley 26.370 (admisión y permanencia), bartenders para evento corporativo, brief de promotoras, stage manager, fiesta de fin de año de empresa, app para trabajar en eventos, seguridad privada en CABA, de staff a coordinador, runner, stand en feria. Página /para nueva: planilla y WhatsApp o LABURO.

## Publicadas el 30/10, noche adelantada (no repetir)
Montaje y desmontaje (cómo cuidarte), trabajar en eventos en verano en la costa, cómo evaluar al staff después del evento, cómo describir tu salón, monotributo para trabajar en eventos (cifras de ARCA vigentes desde el 1/08/2026: revisar en cada recategorización, febrero y agosto), personal de limpieza, staff para un casamiento, staff para un festival al aire libre, trabajar de bartender en eventos, staff para un evento deportivo, trabajar de mozo en eventos, fiesta de 15, lanzamiento de producto, recital o show en vivo, volver a casa de madrugada, trabajar siendo estudiante, casting de promotoras, contestar una consulta de salón, salón en temporada de fin de año, trabajar después de los 40, organizar los pagos del staff, evento en un hotel, proveedores en fin de año, feria gastronómica, evento de verano en la costa, quinta o salón con pileta, preparar la visita al salón, qué llevar si trabajás de staff, bajarte de un evento que aceptaste. Páginas /para nuevas: agencia de promotoras o plataforma; portales de empleo o LABURO (para quien trabaja). Otra sesión publicó la misma noche: temporada alta de diciembre, coordinador de staff, congreso o convención, dress code, ficha de proveedor, habilitación de salón en CABA, responder un pedido de presupuesto (mirar `content/blog/` antes de elegir tema).
- El pool se dice «más de 1.100 postulantes» (la home muestra +1.200; las notas viejas decían 680 y se corrigieron).

## Imagen para compartir
Cada nota y cada página /para genera sola su imagen con el título (`app/blog/[slug]/opengraph-image.tsx`, `lib/og.tsx`). No hay que hacer nada al publicar.

## Próximos temas (priorizados, 28/10 a la mañana)
1. Staff para eventos en Misiones y en Bariloche (solo si Franco dice dale a la decisión C-1; hay pool real ahí).
2. Agencia de promotoras o plataforma: comparativa honesta (página /para, como la de planilla y WhatsApp).
3. Qué hace un guardarropa en un evento y cómo se organiza.
4. Hostess y recepción en eventos corporativos: qué se pide.
5. Cómo armar un equipo de sampling o degustación (si se toca alcohol, Ley 24.788 abierta).
6. Montaje y desmontaje: qué pide el oficio y cómo se cuida el cuerpo (solo con fuente oficial de la SRT si se dan datos).
7. Traductores e intérpretes en congresos: qué perfil y cuántos.
8. Temporada de verano en la costa: cómo conseguir trabajo en eventos (publicar en noviembre, sin datos inventados).
9. Cómo evaluar al staff después del evento (favoritas con nota en LABURO).
10. Para salones: cómo describir tu espacio para que te encuentren (capacidad, zona, fotos).
