# Phase 2: Find Staff - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

The first UI of the app: Franco logs in from his phone, searches/filters the real 687-applicant pool in `staff_app.staff_profiles` (by oficio multi-select + free text + provincia/ciudad/availability), and opens a candidate profile with data + CV. Next.js 15 standalone app, mobile-first, reading the app's own schema. NO offers, NO emails, NO HITO anything (Phases 3+/6).

</domain>

<decisions>
## Implementation Decisions

### Marca e identidad visual (Franco, 2026-07-14)
- **D-01:** La app tiene **marca propia — explícitamente NO el look de SOMOS DER ni el de HITO**. Dirección estética de Franco (textual): "algo con azul, confianza, que sea atractivo, letras medio glow, que sea tipo globos" — referencia: tipografías **neon bubble** (estilo alfabeto neón burbuja, ver refs de Shutterstock "neon bubble font"). Traducción de diseño (a criterio de Claude, validada por esta discusión): base oscura con **azul como color primario (confianza)**, efectos glow/neon como acento de identidad (logo, headers, estados activos, CTAs) y tipografía bubble/redondeada SOLO en momentos de marca — la UI de trabajo (listas, formularios, perfiles) se mantiene limpia y legible. Debe resultar atractiva para el rubro eventos/nightlife (los usuarios finales del marketplace v2 son trabajadores de eventos).
- **D-02:** **Nombre de la app: lo propone Claude** (Franco: "ENTRA e HITO salieron como idea tuya, pensalo vos también"). Propuesta trabajada: **LABURO** (working name — argentinismo universal para "trabajo", exactamente lo que la app da: laburo en eventos; corto, cálido, memorable, y las letras redondas B/U/O rinden perfecto en tipografía bubble con glow). Alternativas consideradas: BOLO (jerga del rubro para gig/trabajo puntual), CONVO (de convocatoria). Franco puede vetar/cambiar; hasta confirmación explícita, usar LABURO en UI y "LABURO (working name)" en docs. NO usar sufijo "by DER" en la marca visible salvo pedido de Franco.

### Pantalla de búsqueda (Franco + discreción guiada)
- **D-03:** Resultados como **tarjetas por candidato** — SIN foto (el pool no tiene fotos; usar avatar de iniciales con color derivado, p.ej. por oficio principal). Contenido de tarjeta: nombre, oficios como tags, provincia/ciudad, señal de experiencia. Criterios de Franco: "sencillo, rápido, legible y por sobre todas las cosas atractivo", todo **mobile adaptive**.
- **D-04:** Filtros **híbridos** (a Franco le gustaron ambas opciones): buscador de texto + chips de oficios tocables arriba (lo frecuente, 1 tap), y un panel "Filtros" completo para lo fino (provincia, ciudad, disponibilidad finde/viajar, movilidad propia). Los datos de provincia/ciudad ya están normalizados (Fase 1) — el filtro por provincia usa las 24 jurisdicciones oficiales.

### Login de Franco
- **D-05:** **Supabase Auth con login social + magic link.** Franco pidió "gmail, github, accesos con plataformas, facebook y todas esas cosas además de magic link". Aterrizaje v1 (cero-costo, cero-fricción): **Google OAuth + email magic link (OTP)** en esta fase — cubre sus dos cuentas; **GitHub** solo si resulta trivial de configurar; **Facebook y demás providers DIFERIDOS** (requieren crear/app-review en Meta — fricción sin valor para 1 usuario; anotado para v2 marketplace).
- **D-06:** Emails admin autorizados: **ridaofrancorg@gmail.com Y franco@somosder.ar** (ambos). ⚠️ Gate de seguridad crítico: el signup social/OTP de Supabase es abierto — el acceso al panel se controla por **membresía** (`staff_app.members` contra `auth.users`): solo los emails autorizados ven datos; cualquier otro login queda sin org y sin acceso. (El pool son PII de 687 personas — no puede verlo un curioso que se loguee con Google.)

### Claude's Discretion
- **CV en el perfil:** decidir el mejor render sabiendo que 679 CVs son links de Google Drive (`drive.google.com/open?id=...`) y 8 son objetos del bucket propio (`staff-cvs`, privado → signed URL corta). Recomendación por defecto: visor embebido cuando sea viable (Drive `/preview` iframe si los permisos lo permiten; PDF propio embebido) con fallback universal "Abrir CV" en pestaña nueva. No romperse si un Drive link está muerto.
- **Acciones rápidas del perfil:** elegidas por Claude → **botones WhatsApp (wa.me) y llamar (tel:)** con el teléfono del candidato — encaja con el flujo real de Franco (hoy contacta por WhatsApp); la oferta formal llega en Fase 3.
- Micro-interacciones y animaciones: con **Motion** (`motion`, import desde `motion/react`) — preferencia global del usuario; usarlas con moderación en mobile.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Fase 1 (lo ya construido — la base que esta fase consume)
- `.planning/phases/01-own-data-foundation/01-01-SUMMARY.md` — schema `staff_app`, tablas, org UUID `aa29aa2f-4d34-4e53-b62c-7397e8a4d123`, proyecto `luillpzfqzbpoqkgvjuw`
- `.planning/phases/01-own-data-foundation/01-03-SUMMARY.md` — form vivo vía RPC, mismas URL/keys del proyecto
- `.planning/phases/01-own-data-foundation/01-REVIEW.md` — 8 warnings; los que tocan esta fase: WR-05 (default ACL anon del schema — endurecer al crear objetos nuevos), WR-04 (roles de members sin CHECK — corregir al construir el gate de membresía)
- `supabase/migrations/staff_app_0001_schema_orgs.sql` y `staff_app_0002_core_tables.sql` — DDL real (columnas exactas para tipar la búsqueda)

### Código externo de referencia (patrones de CÓDIGO, no de look)
- `/Users/fridao/Proyectos/HITO-by-DER-main` — auth gate + org layout (`app/[orgSlug]/layout.tsx`), clientes Supabase SSR (`lib/supabase/*`), componentes Base UI — copiar mecánica, NO estética
- `.planning/research/STACK.md` — stack lockeado (Next.js 15.5, React 19, @supabase/ssr, Base UI, Tailwind 4, Motion, versiones y gotchas)

### Estética
- Referencia de Franco: tipografías "neon bubble font" (búsqueda Shutterstock) — azul, glow, burbuja. NO usar el Brand Kit de SOMOS DER ni el look de HITO como sistema visual (solo como vara de calidad).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Datos listos: 687 perfiles con oficios `text[]`, provincia normalizada (24 oficiales), ciudad, flags de disponibilidad/movilidad, cv_url — la búsqueda se construye sobre columnas ya limpias.
- HITO repo local: auth gate, org layout y wrappers Base UI copiables 1:1 (mecánica probada).
- El repo staff-app aún no tiene app code — esta fase crea el scaffold Next.js.

### Established Patterns
- RLS + membresía org-scoped ya operativa en `staff_app` (Fase 1); el dashboard consulta como usuario autenticado miembro — nunca con service role en cliente.
- Supabase MCP disponible para migraciones nuevas (p.ej. índices de búsqueda, vínculo members↔auth.users).

### Integration Points
- Proyecto Supabase `luillpzfqzbpoqkgvjuw`, schema `staff_app` (¡PostgREST no expone el schema! — el acceso de datos del dashboard va por el server de Next con conexión que fije `search_path`/schema, o exponiendo `staff_app` a PostgREST para authenticated, o vía RPCs/vistas — decisión técnica del planner con el research; el executor tiene MCP para configurarlo).
- Deploy: Vercel (CLI logueado ridaofranco-8135), proyecto nuevo para la app.

</code_context>

<specifics>
## Specific Ideas

- Franco, textual sobre el look: "azul, confianza, atractivo, letras medio glow, tipo globos... no quiero usar como DER, ni como HITO... que sea atractivo para este tipo de rubros".
- Tarjetas: "sencillo, rápido, legible y por sobre todas las cosas atractivo... toda la app tiene que ser mobile adaptative".
- Login: "gmail, github, accesos con plataformas, facebook y todas esas cosas además de magic link".

</specifics>

<deferred>
## Deferred Ideas

- **Facebook OAuth y otros providers sociales** → v2 (requieren app de Meta + review; sin valor para 1 usuario interno).
- **Fotos de los candidatos** → v2 (panel del staff, MRKT-02 — hoy el pool no tiene fotos).
- **Ubicación elegida por el staff + autocomplete de mapa** → v2 (ya anotado en Fase 1; Georef/OSM, no Google Maps).

</deferred>

---

*Phase: 02-find-staff*
*Context gathered: 2026-07-14*
