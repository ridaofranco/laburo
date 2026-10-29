-- 0093 · La productora ve sus búsquedas y quién se postuló (turno noche B, 29/10/2026).
--
-- Las vistas public.staff_app_busquedas (0053) y public.staff_app_postulaciones
-- (0052) son security_invoker: leen gig_openings y gig_applications con los
-- permisos de quien mira, y la RLS de esas tablas (is_org_member) recorta a su
-- organización. Pero nunca se le dio SELECT sobre las tablas al rol
-- authenticated, así que las dos vistas fallaban con «permission denied» y
-- /tablero/<evento>/busquedas decía «Todavía no publicaste ninguna búsqueda»
-- aunque hubiera búsquedas publicadas con gente postulada.
--
-- Solo lectura. Las escrituras siguen yendo por las funciones de la 0052/0053.
-- La RLS ya estaba activa y con política de lectura por organización.

GRANT SELECT ON staff_app.gig_openings     TO authenticated;
GRANT SELECT ON staff_app.gig_applications TO authenticated;
