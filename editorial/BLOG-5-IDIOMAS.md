# Blog de LABURO en 5 idiomas

Desde el 06/11/2026 el blog de LABURO funciona igual que el de somosder.ar: cada nota puede tener versión en inglés, portugués, francés e italiano, con hreflang recíproco, x-default a la española, sitemap con alternates y llms.txt. **Para publicar una traducción alcanza con agregar un .md.** No hay que tocar código.

## La convención en dos líneas

- El español queda donde estuvo siempre: `content/blog/<slug>.md` → `/blog/<slug>`. Las traducciones van en `content/blog/<idioma>/<slug-nativo>.md` (idioma = `en`, `pt`, `fr` o `it`) y salen en `/<idioma>/blog/<slug-nativo>`.
- Cada traducción lleva `traduccionDe: <slug-español>` en el frontmatter. Ese campo une las versiones: el hreflang, el selector ES · EN · PT · FR · IT, el sitemap y el llms.txt se arman solos.

## Frontmatter de una traducción

```yaml
---
title: "How many staff do you need for an event, and how to calculate it"
seoTitle: "How Many Staff Do You Need for an Event? | LABURO"
description: "Entre 140 y 160 caracteres, escrita para la búsqueda real en ese idioma."
slug: "how-many-staff-for-an-event"
traduccionDe: "cuanta-gente-necesito-para-mi-evento"
kicker: "Guide"
pubDate: 2026-07-29
readingTime: "8 min"
order: 1
lang: en
faqs:
  - q: "Pregunta en el idioma de la nota"
    a: "Respuesta de 2 a 4 oraciones que se entienda sola."
---
```

Reglas de cada campo:

| Campo | Regla |
|---|---|
| `slug` | Igual al nombre del archivo. En el idioma de la nota, minúsculas, sin acentos, 3 a 6 palabras con la búsqueda real de ese idioma. Nunca el slug español traducido palabra por palabra. |
| `traduccionDe` | El slug EXACTO de la nota española (el nombre del archivo en `content/blog/` sin `.md`). Si está mal, la nota se publica igual pero sin hreflang. También se acepta `es:` como alias. |
| `title` | El H1, nativo. |
| `seoTitle` | Hasta 60 caracteres, termina en `\| LABURO`. (También se acepta `metaTitle`, el nombre que usan las notas en español.) |
| `description` | 140 a 160 caracteres. |
| `pubDate` | La MISMA fecha que la nota española (`date` en el original). También se acepta `date`. |
| `lang` | `en`, `pt`, `fr` o `it`; tiene que coincidir con la carpeta. |
| `kicker` | `Guide` (en, fr), `Guia` (pt), `Guida` (it). Si se omite, sale ese por defecto. |
| `order` | Orden dentro del índice de ese idioma (menor primero). |
| `canonical` | NO ponerlo: se arma solo (`https://laburo.somosder.ar/<idioma>/blog/<slug>`). |
| `faqs` | Las mismas preguntas del original, traducidas. El título de la sección FAQ lo pone la página en cada idioma: no va en el .md. |

## Reglas del texto

- Nota nativa, no palabra por palabra. Misma respuesta directa en el primer párrafo, mismas secciones, misma FAQ.
- Nunca guion largo (—) ni semiguion (–).
- Nada inventado: ni cifras, ni clientes, ni funciones que LABURO no tiene. Lo local (monotributo, ARCA, pesos, carnet de manipulador de CABA, leyes argentinas) se adapta a algo neutro («el nombre y los requisitos dependen de tu país o ciudad»), sin inventar leyes de otro país.
- LABURO opera en Argentina y la app es solo en castellano. Las traducciones lo dicen sin vueltas y **no** mandan a `/sumate`, `/registrar-productora` ni `/` (son pantallas en español). El cierre de cada nota es un H2 + WhatsApp con el texto ya escrito en ese idioma: `https://wa.me/5491171540675?text=...` (texto con `encodeURIComponent`). La página, además, agrega sola el bloque de cierre con botón de WhatsApp.
- SOMOS DER se enlaza al .com en el idioma: `https://somosder.com` (en), `https://somosder.com/pt/`, `/fr/`, `/it/`.
- Enlaces internos: solo a notas que existan EN ESE IDIOMA (`/<idioma>/blog/<slug>`). Si el original enlaza a una nota que todavía no tiene versión en ese idioma, se saca el enlace. Nada de `/para/...` (las páginas por público son solo en español).
- Clientes vetados: nunca (ver la memoria de clientes que no se nombran).

## Cómo se suben las traducciones de la revista automática

La revista deja cada traducción en `editorial/traducciones/<slug-español>.<idioma>.md` (por ejemplo `editorial/traducciones/cuanta-gente-necesito-para-mi-evento.en.md`). Esa carpeta NO se publica: es la bandeja de entrada. Para subir una:

1. Revisar el frontmatter contra la tabla de arriba (sobre todo `slug` nativo, `traduccionDe` = el `<slug-español>` del nombre del archivo, `pubDate` igual al original, `lang`).
2. Moverla con el nombre nuevo: `git mv editorial/traducciones/<slug-español>.<idioma>.md content/blog/<idioma>/<slug-nativo>.md`.
3. Revisar los enlaces internos (solo a notas que ya existan en ese idioma) y que no haya guiones largos.
4. Validar y publicar como cualquier nota (abajo).

Chequeo rápido de todas las traducciones (frontmatter, slug = archivo, original existente, longitudes, guiones, enlaces internos):

```bash
python3 - <<'EOF'
import glob, yaml, re, os
slugs = {}
for f in glob.glob('content/blog/*/*.md'):
    slugs.setdefault(f.split('/')[2], set()).add(os.path.basename(f)[:-3])
for f in sorted(glob.glob('content/blog/*/*.md')):
    raw = open(f).read(); fm = yaml.safe_load(raw.split('---')[1]); lang = f.split('/')[2]
    assert fm['slug'] == os.path.basename(f)[:-3] and fm['lang'] == lang, f
    assert os.path.exists(f"content/blog/{fm['traduccionDe']}.md"), f
    print(lang, fm['slug'], len(fm['seoTitle']), len(fm['description']), 'guiones:', len(re.findall('[—–]', raw)))
    for l in re.findall(r'\]\((/[^)]+)\)', raw):
        m = re.match(r'/(\w\w)/blog/([^/#?]+)', l)
        if not m or m.group(1) != lang or m.group(2) not in slugs[lang]: print('  ENLACE MALO', l)
EOF
```

## Publicar

1. `npx tsc --noEmit` y `next build` (las rutas son estáticas: si una traducción tiene el frontmatter roto, el build lo muestra).
2. Push a main (Vercel publica solo).
3. Verificar en producción: la nota da 200, tiene `<link rel="alternate" hreflang=...>` hacia todas sus versiones y la española también la lista, y aparece en `/sitemap.xml` (con `xhtml:link`) y en `/llms.txt`.

## Dónde está el código (por si hay que tocarlo)

- `lib/blog.ts`: `IDIOMAS_TRADUCCION`, `getPostsByLang`, `versionesDe` (arma el grupo de versiones), `hreflangDe` y `hreflangIndices`.
- `lib/blog-i18n.ts`: textos fijos por idioma (header, FAQ, cierre, mensaje de WhatsApp).
- `app/blog/_intl/` (índice, nota, cabecera, imagen OG) y una carpeta fija por idioma, `app/<idioma>/blog/page.tsx` y `app/<idioma>/blog/[slug]/` (page, opengraph-image, twitter-image), que solo llaman a `_intl`. Todo estático (`generateStaticParams` + `dynamicParams = false`). NO usar una carpeta `app/[lang]` de primer nivel: la regla `no-html-link-for-pages` de `next build` toma entonces cualquier `<a href="/x">` del sitio como página y el deploy falla (pasó el 06/11).
- `app/blog/idiomas.tsx`: selector de idioma, que también aparece en la nota española cuando tiene traducciones.
- `app/sitemap.ts` y `app/llms.txt/route.ts`: suman las traducciones solas. `content/blog/**/*` ya está en `outputFileTracingIncludes` (si no, en Vercel el sitemap sale sin ellas).
- `lib/supabase/middleware.ts`: `/en/blog`, `/pt/blog`, `/fr/blog` e `/it/blog` están en `publicPrefixes`. **Un idioma nuevo** necesita: sumarlo en `IDIOMAS_TRADUCCION` y `HREFLANG` (lib/blog.ts), sus textos en `lib/blog-i18n.ts`, su prefijo en el middleware y copiar la carpeta `app/en/blog` cambiando el código de idioma.
