# LABURO — Sistema de diseño oficial (post-Fase-5 reskin)

**Fuente:** el ecosistema de Stitch de Franco, sistema **"Radical Minimalist"** (elegido; el segundo, "Tech Noir Synthetic", queda descartado). Tokens completos en `RADICAL-MINIMALIST.source.md`; las 24 pantallas de referencia en `stitch-export/`.

**Cuándo se aplica:** como reskin, TODO junto, DESPUÉS de la Fase 5 (decisión de Franco, para no reskinear dos veces). La app se construye en placeholder hasta entonces; el reskin es un swap de tokens + adaptación de componentes, no reconstrucción de pantallas.

## Tokens núcleo (de Radical Minimalist)
- **Color:** negro absoluto (`#000000` / superficies `#131313`, `#0e0e0e`, `#1c1b1b`), texto off-white (`#F5F5F5` / `#e5e2e1`), variante `#cfc4c5`, outline hairline `#4c4546`/`#1A1A1A`. Acento **azul eléctrico `#0047FF`** (tertiary `#4266ff`/`#b9c3ff`) usado con MUCHÍSIma restricción: solo estados activos, interacción crítica, hover de borde. Nada de repartir color.
- **Tipografía:** **Syne** headlines (monumental, hasta 120px, tracking negativo −0.02/−0.04em, lh 110%); **Inter** body (16-18px, lh 160%); **Geist** labels/técnico (12px, uppercase, letter-spacing 0.1em). Estas 3 fuentes, incrustadas.
- **Forma:** **radio 0px en todo** (botones, inputs, cards) — 90° duros, arquitectónico. Círculos solo para avatares/radios.
- **Profundidad:** sin sombras; capas tonales + bordes hairline 1px `#1A1A1A`; blur 10-20px solo en navbars/overlays.
- **Layout:** grilla 12 col, `container-max` 1440px, márgenes 80px desktop / 24px mobile (sagrado), `section-gap` 160px (aire enorme), stacks 8/24/48px.
- **Componentes:** botón primario sólido `#F5F5F5` texto negro, hover "ghost" (borde). Cards borde 1px, hover → borde azul. Listas separadas por reglas 1px, padding 24-32px. Nav text-only Geist, activo = subrayado 2px azul o punto.

## ⚠️ A reconciliar antes del reskin
El logo de Franco es **bubble ROSA** (jugado, cálido). El sistema es **negro/monumental/austero**. Chocan. Decisión pendiente de Franco: (a) el logo rosa queda como pop cálido contra el negro (contraste intencional), o (b) se hace una variante del logo que aline con el minimalismo radical. No resuelto.

## Mapa Stitch → app real (QUÉ es v1 y QUÉ es v2)
Las 24 pantallas de Stitch cubren mucho más que v1. v1 = 1 contratación real. El resto = v2, valen como visión/pitch, NO se construyen ahora.

**v1 (lo que YA estamos construyendo, se reskinea con este sistema):**
- `laburo_landing_page_publica` → landing
- `laburo_login_minimalista_radical` → login (Fase 2)
- `buscar_staff_minimalista_radical` → búsqueda (Fase 2)
- `perfil_detalle_minimalista_radical` / `perfil_minimalista_radical` → perfil (Fase 2)
- `enviar_oferta_minimalista_radical` + `confirmacion_envio_minimalista_radical` → crear/enviar oferta (Fase 3)
- `propuesta_mobile_minimalista_radical` → página pública `/o/token` aceptar/rechazar (Fase 4)
- `gestion_de_evento_minimalista_radical` → tablero por gig (Fase 5, STAT-02)
- `mis_favoritos_minimalista_radical` → favoritos (Fase 5, XTRA-01)
- `configuracion_de_agencia` → ajustes
- `estados_sin_resultados_error` → estados vacío/404
- `dashboard_minimalista_radical` / `dashboard_productor_laburo` → dashboard (parcial v1)

**v2 (mockups de Stitch para la visión; NO construir en v1):**
- `billetera_de_documentacion_laburo` → billetera de documentos (seguros/carnets, validación) — la que proponés ahora
- `dashboard_de_rentabilidad_laburo` → analytics/rentabilidad (márgenes, ranking, proyección) — la que proponés ahora
- `fichaje_operativo_mobile` → check-in/out por geolocalización — la que proponés ahora
- `pagos_y_liquidaciones_laburo` → pagos (en v1 el pago es SOLO informativo)
- `mensajeria_directa_laburo` → chat interno
- `calendario_maestro_laburo` → calendario
- `centro_de_notificaciones_laburo` → notificaciones
- `onboarding_staff_laburo` → onboarding tutorial
- `dashboard_staff_laburo` / `editar_perfil_staff` → lado staff con cuenta (v1 el staff NO tiene cuenta, entra por link mágico)

**Regla:** sobre-scopear es el riesgo #1 que mató a HITO. v1 ships con 1 contratación real. Los mockups v2 son oro para vender, no para construir todavía.
