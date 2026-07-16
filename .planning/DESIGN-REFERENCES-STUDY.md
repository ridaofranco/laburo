# LABURO — Estudio de las 10 referencias (2026-07-16)

Análisis de datos crudos (fuentes exactas, hex, px, springs) extraído del HTML server-rendered de cada template de Framer que eligió Franco. Objetivo: calcar el lenguaje visual de diseñador humano, no generar de cero.

Marca base de LABURO: dark `#0A0F1F`, azul `#2F80FF`, glow `#4CC9FF`, tipografía bubble solo en el logo, Inter para UI, mobile-first.

---

## Ficha por sitio

| Sitio | Modo | Display | Body | Acento | Rasgo firma |
|-------|------|---------|------|--------|-------------|
| **fuel** | dark monocromo | BDO Grotesk Variable | Inter | #D1E1E8 (único) | Sistema de índices `(01) (About) © 2025`, tracking −4%, lh 1.0 |
| **cohesion** | light | Public Sans | Inter 24px | mint #66FFD9 + verde #00CC99 | Nav-pill con blur, números fantasma 200px, bullet doble círculo |
| **nubo** | mixto crema/charcoal | Poppins | Poppins | amarillo pálido #FFFDBD | Hero palabra por palabra, sombra de 5 capas, kickers Abel uppercase |
| **plat-form** | **dark cálido** | Inter Display | Inter Display | naranja #FA6F45 (avaro) | Neutros entintados, scroll progress bar 2px, botón con máscara, radio 2px |
| **agero** | light | Cal Sans | Inter | naranja #FF4D00 | Botón glass pill, reveal letra por letra con blur, ticker diagonal 6°, noise-bg |
| **aixor** | **dark monocromo** | Urbanist + Arapey italic | Urbanist | casi nulo (#959EFE) | Gradient text-fill blanco→gris, slide-up 160px sin fade, cards con bordes iluminados |
| **createstudio** | light | Figtree | Figtree | naranja #FF6041 | Labels mono `// 001`, botón wipe por letras, sticky-stack, fit-text SVG |
| **agenciy** | **dark monocromo** | Inter (140px, −6%) | Inter | ninguno (gradient text) | Superficies white-alpha, inset light bevel, pill nav con gradiente |
| **porto** | **dark total** | Clash Display uppercase | Inter Display | grises (verde/rojo 1 vez) | Wordmark fit-to-viewport, springs 200/40, hairlines, highlighter hover |
| **portfolite** | **dark monocromo** | Satoshi | Inter Display | oro #FFD700 (solo estrellas) | **Main Button de 3 capas con glow interior**, cards con luz de canto, blur-to-focus |

**Lectura clave:** 6 de 10 son dark, y las 4 dark monocromas (aixor, agenciy, porto, portfolite) son la veta directa para LABURO. plat-form es la más afín conceptualmente (dark + un solo acento + Inter). portfolite aporta el botón que la marca necesita (glow celeste literal).

---

## Patrones comunes (lo que hace a TODAS verse de diseñador, no de IA)

1. **Un solo acento, usado con avaricia.** Ninguna reparte color. El acento aparece en 2-3 lugares (palabras del H1, botón primario, un dot). Todo lo demás es neutro. LABURO: `#2F80FF` para acción primaria + `#4CC9FF` solo para glow, nada más.

2. **Jerarquía por opacidad/luminancia, no por colores nuevos.** Texto pleno vs mismo color al 50-65%. Bordes al 10%. Dos o tres variables, cero grises sueltos inventados. (fuel, agenciy, portfolite, aixor lo hacen idéntico.)

3. **Tracking negativo proporcional al tamaño.** −4% a −6% en headings grandes, hasta el body lleva −0.5px. line-height ≤ 1.0 en titulares. Es EL detalle que hace ver caro.

4. **Neutros entintados hacia el hue de marca** (plat-form). Nunca `#fff`/`#000` puros en texto: off-white frío y superficies en 4 escalones tintados. Para LABURO: `#0A0F1F → #10182B → #16203A → borde #2A3552`, texto `#DDE5F2` / muted `#8A93A6`.

5. **Sistema de eyebrows/índices.** Label chico (mono o uppercase) numerado arriba de cada sección: `// 001`, `(01) (Postulantes)`, `01/02`. Señal de diseño altísima, costo casi cero.

6. **Reveal del hero escalonado**, palabra por palabra o letra por letra, con blur-to-focus o slide desde y. Springs firmes (damping alto), sin rebote infantil. Nunca todo fade-up al mismo tiempo.

7. **Profundidad por materiales, no por sombras planas.** Inset light bevel (luz de canto superior), hairlines tono-sobre-tono, noise-bg, glow interior. Nadie usa `box-shadow: 0 4px 12px rgba(0,0,0,.2)` genérico.

---

## Recetas portables a LABURO (valores listos para construir)

### Tipografía
- Headings: Inter (o Inter Display) weight 500-600, **letter-spacing −0.05em / −0.06em**, **line-height 0.9-1.1em**. Hero 80-140px desktop, 48-80px mobile.
- Body: Inter 400, 16-18px, ls −0.01em / −0.04em, lh 1.3-1.4.
- Eyebrow/labels: mono uppercase (IBM Plex Mono o JetBrains Mono), 12-14px, numerado `// 001`, color `#2F80FF`.
- Logo "LABURO": tipografía bubble, fit-to-viewport en el footer (lh 80%, ls −3px).
- Stats: Inter con `font-feature-settings: 'tnum' on, 'zero' on` (números que no bailan + cero cruzado).

### Paleta (tokens)
```
--bg:        #0A0F1F   (fondo)
--surface-1: #10182B   (cards)
--surface-2: #16203A   (elevado)
--border:    #2A3552   (hairline) / rgba(255,255,255,0.1)
--text:      #DDE5F2   (off-white frío, NO #fff puro)
--muted:     #8A93A6
--accent:    #2F80FF   (acción primaria, avaro)
--glow:      #4CC9FF   (solo glow/highlight)
```
Jerarquía de texto: `--text` / `rgba(221,229,242,0.65)` / bordes `rgba(255,255,255,0.1)`.

### Botón primario (calcado de portfolite, azul)
3 capas: exterior `#2F80FF@40%` radius 11.5px → inner `#0A0F1F` radius 10px (bisel 1.5px) → dos pills radiales con centro `#4CC9FF` `filter: blur(10px)` opacity 0.41. Hover: encender `box-shadow: 0 1px 9px rgba(76,201,255,0.5)`. Es el botón que la marca pedía.

Alternativa (plat-form): botón cuadrado radius 2-4px, relleno `#2F80FF`, label oscuro revelado con `mask: linear-gradient(270deg,...)` animada en hover.

Secundario (aixor): superficie-sobre-superficie, pill `#131C33` sobre el dark, reservar el azul solo para primaria.

### Cards (portfolite + agenciy)
```
background: linear-gradient(180deg, #101830, #0A0F1F);
border: 1px solid rgba(255,255,255,0.1);
box-shadow: 16px 24px 20px 8px rgba(0,0,0,0.4),
            inset 0 2px 0 rgba(76,201,255,0.08);   /* luz de canto celeste */
border-radius: 17px;
```

### Navbar (portfolite/cohesion)
Full width o pill flotante centrada, `backdrop-filter: blur(12px)`, `background: rgba(10,15,31,0.85)`, borde `rgba(76,201,255,0.15)`. Entra desde y:-77/-160 con spring.

### Gradient text para el hero (aixor)
```
background-image: linear-gradient(90deg, #FFF 16%, #4CC9FF 140%);
background-clip: text; color: transparent;
```
Blanco que muere en glow celeste. O palabra clave del H1 en `#4CC9FF`.

### Detalles anti-IA baratos
- **Noise-bg** (agero): PNG de ruido al 4-6% sobre los paneles azul oscuro. Mata el flat de IA al toque.
- **Scroll progress bar** de 2px `rgba(47,128,255,0.4)` bajo la navbar (plat-form).
- **Notch de disponibilidad** (agero/porto): pill radius 50px + dot verde `#61C554` + "Postulaciones abiertas" o "X vacantes" en el header. Dato vivo = producto vivo.
- **Hairlines** `#1A2440` sobre `#0A0F1F` como única estructura, cero sombras genéricas (porto).
- **Highlighter hover** (porto): pill azul que se expande detrás de la fila e invierte el texto. Ideal para listados de staff/eventos.
- **Ticker diagonal** 6° azul con texto repetido ("STAFF · EVENTOS · ACCESOS") y mask-fade en bordes.

### Motion (Motion / `motion/react`) — valores exactos portados
- **Nav:** `initial={{y:-77}}` spring `{bounce:0.2, delay:0.3, duration:0.8}` (nubo) o `{stiffness:300, damping:60, mass:1}` (fuel).
- **Hero palabra por palabra:** `initial={{opacity:0, y:10, filter:'blur(10px)'}}` → `{opacity:1, y:0, filter:'blur(0px)'}`, `staggerChildren` ~30-80ms (portfolite/agero).
- **Slide-up de líneas sin fade** (aixor): contenedor `overflow:hidden`, hijo `initial={{y:160}}` spring `{stiffness:200, damping:40}`, stagger 0.2s.
- **Cards al scroll:** spring `{stiffness:137, damping:30, mass:1.4}` (agero) o `{stiffness:200, damping:40, mass:1}` (porto).
- **Cascada direccional del hero** (plat-form): delays 0/0.1/0.3/0.5/0.7/0.9, `ease:[0,1.03,0.56,1]`, elementos entrando desde x negativo, x positivo e y (no todo fade-up).
- **Fades secos** para UI secundaria: spring `{stiffness:400, damping:30}`, delay 0 (aixor). Timing que hace sentir la app rápida y no "animada de más".
- Respetar `prefers-reduced-motion` (nubo lo hace).

---

## Recomendación de dirección para LABURO

La familia dark-monocroma-con-un-acento (aixor + agenciy + porto + portfolite + plat-form) es el camino. Concretamente:

- **Base y color:** neutros entintados de plat-form + jerarquía por opacidad de agenciy/portfolite.
- **Botón primario:** el de 3 capas de portfolite (el glow celeste es literalmente la marca).
- **Cards y profundidad:** luz de canto de portfolite + hairlines de porto.
- **Tipografía:** Inter tight (−0.05em, lh <1) de agenciy + eyebrows mono numerados de createstudio.
- **Hero/motion:** blur-to-focus palabra por palabra de portfolite + springs firmes de porto.
- **Toques de producto:** notch de disponibilidad (agero), scroll progress bar (plat-form), stats con tabular nums.

Esto da una app que se ve "estudio caro" y a la vez "operaciones de eventos", sin ningún tell de IA.

## Próximo paso
1. Franco aprueba la dirección (o ajusta el mix).
2. Definir el sistema de diseño completo (tokens + componentes) en un DESIGN-SYSTEM.md.
3. Diseñar las pantallas (login, dashboard/búsqueda, perfil+CV, oferta, aceptación) con ese sistema, aprobar, y recién ahí construir.
