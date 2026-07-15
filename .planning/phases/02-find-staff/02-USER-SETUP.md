# Phase 2 — User Setup (Supabase Auth compartida, proyecto luillpzfqzbpoqkgvjuw)

**Status:** Mostly complete (1 item to confirm)

## Env vars (`.env.local`, git-ignored) — ✅ DONE (2026-07-15)

| Var | Value / Source | Estado |
|-----|----------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://luillpzfqzbpoqkgvjuw.supabase.co` | ✅ set (via MCP) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key del proyecto (pública) | ✅ set (via MCP) |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard → Project Settings → API (SECRETA, server-only, nunca `NEXT_PUBLIC_`) | ✅ set (Franco, formato `sb_secret_…`) |
| `SITE_URL` | `http://localhost:3000` (dev) | ✅ set |

## Dashboard config

| Task | Location | Estado |
|------|----------|--------|
| Google provider habilitado | Auth → Providers → Google | ✅ confirmado por Franco ("todo prendido") |
| Email OTP / magic link habilitado | Auth → Providers → Email | ✅ confirmado por Franco |
| **Agregar `http://localhost:3000/auth/callback` a Redirect URLs (ADITIVO — no tocar las URLs de HITO)** | Auth → URL Configuration → Redirect URLs | ⚠️ **A CONFIRMAR** — la confirmación fue ambigua. Si al hacer login con Google/magic link el navegador vuelve a una URL equivocada (no a `localhost:3000`), es esto: agregá la URL exacta y reintentá. |
| Futuro: agregar `https://<dominio-laburo>.vercel.app/auth/callback` cuando exista el proyecto Vercel | Auth → URL Configuration → Redirect URLs | Pendiente (deploy llega en un plan posterior) |

## Verificación

```bash
npm run dev
# abrir http://localhost:3000 → redirige a /login
# "Entrar con Google" → debe volver a http://localhost:3000/ logueado
```

Si el login vuelve a otra URL o falla con error de redirect: falta el item ⚠️ de arriba.
