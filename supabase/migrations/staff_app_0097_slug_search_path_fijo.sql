-- 0097 · search_path fijo en staff_app.slug_desde_nombre (aviso «function_search_path_mutable»
-- de Supabase, 29/10/2026). La función solo usa funciones de pg_catalog (translate, lower,
-- regexp_replace, btrim, nullif), así que se fija ahí y nadie puede cambiarle el sentido
-- poniendo otra función con el mismo nombre más adelante en el search_path. Aditivo: no
-- cambia lo que devuelve.
ALTER FUNCTION staff_app.slug_desde_nombre(text) SET search_path = pg_catalog;
