# Cómo se deploya LABURO

## El auto-deploy volvió a funcionar (2026-07-31)

Durante días el `PENDIENTES-DER-MASTER.md` decía que "el auto-deploy de Vercel
está roto en LABURO y ENTRÁ", y por eso cada sesión deployaba a mano con
`npx vercel deploy --prod --yes`.

**Medido por la API de Vercel el 31/7, eso era mitad falso y omitía dos casos:**

| Proyecto | Repo conectado | Estado real ese día |
|---|---|---|
| `entra-by-der` | ✅ `ridaofranco/ENTRA` | Andaba. Los deploys a mano eran innecesarios |
| `pase` | ✅ `ridaofranco/pase` | Andaba |
| `laburo` | ❌ ninguno | Roto de verdad |
| `somosder-sales` | ❌ ninguno | Roto, nunca se había anotado |
| `somosder-web` | ❌ ninguno | Roto, nunca se había anotado |

Franco reconectó `laburo` a `ridaofranco/laburo` (rama de producción `main`)
el 31/7 a la tarde.

## Entonces, ¿cómo se deploya hoy?

**Push a `main` y listo.** No hace falta correr nada.

## Cómo verificar que el auto-deploy sigue vivo

La configuración puede figurar conectada y aun así no disparar, así que no
alcanza con mirar el panel. Lo que lo prueba es el campo `source` del deployment:

- `source=git`  → lo disparó el push. **Es lo que se quiere ver.**
- `source=cli`  → lo disparó alguien con `vercel deploy` a mano.

Se consulta con `GET /v6/deployments?projectId=<id>&limit=5` de la API de Vercel.

## Si alguna vez vuelve a romperse

No se puede arreglar por CLI ni por API: la conexión es un OAuth entre Vercel y
GitHub y necesita a Franco. El camino es Vercel → el proyecto → Settings → Git →
"Connect Git Repository" → GitHub → `ridaofranco/laburo` → rama `main`.

Si el repo no aparece en la lista, es que la Vercel app de GitHub no tiene
permiso sobre él: hay un link "Adjust GitHub App Permissions" que lo resuelve.

## Los dos que siguen desconectados

`somosder-sales` (el Sales OS) y `somosder-web` (la web pública) todavía no
tienen repositorio conectado, así que esos sí hay que seguir deployándolos a mano.
