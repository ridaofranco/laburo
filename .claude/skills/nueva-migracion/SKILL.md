---
name: nueva-migracion
description: Crear la próxima migración SQL de LABURO con las reglas del proyecto (número, prefijo staff_app_, RLS, search_path, grants).
disable-model-invocation: true
---

# Nueva migración de LABURO

1. Número: `ls supabase/migrations | tail -1` y sumar 1 (4 dígitos). Nombre: `supabase/migrations/staff_app_NNNN_<tema_en_snake>.sql`. Nunca editar una migración ya numerada.
2. Solo cambios ADITIVOS e idempotentes (`create ... if not exists`, `create or replace`). Nunca borrar ni pisar datos reales.
3. Toda tabla nueva: `alter table ... enable row level security;` + políticas explícitas en la misma migración.
4. Toda función nueva en `public`: `set search_path = public, pg_temp`; si es `security definer`, `revoke all on function ... from public, anon;` y `grant execute` solo al rol que la usa (REVOKE FROM public no alcanza a anon).
5. Vistas: `with (security_invoker = true)` y GRANT de las tablas que lee.
6. Si toca algo crítico, sumar un harness en `supabase/tests/staff_app_NNNN_<tema>_harness.sql` como los existentes.
7. Aplicar en producción solo con `/root/scripts/supabase-sql.sh` (nunca por el conector), y después correr los advisors de seguridad.
