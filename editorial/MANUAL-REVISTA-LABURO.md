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

## Próximos temas (priorizados, 28/10)
1. Ley 26.370 de admisión y permanencia: qué le pide al personal de puerta (fuente: texto oficial).
2. Temporada alta de eventos: cómo armar el equipo de fin de año con tiempo (publicar en noviembre).
3. Cómo contratar bartenders para un evento corporativo.
4. Qué hace un acreditador y cómo se arma la acreditación de un congreso (enlazar PASE).
5. App para trabajar en eventos: qué mirar antes de cargar tus datos en una plataforma.
6. Staff para eventos en Misiones y en Bariloche (solo si Franco dice dale a C-1; hay pool real ahí).
7. Cómo armar el brief para promotoras de una activación.
8. Qué es un stage manager y cómo se llega a serlo.
9. Seguridad privada en eventos masivos en CABA: qué exige la ciudad (fuente oficial).
10. Cómo pasar de staff a coordinador/a de equipo.
