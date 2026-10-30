-- «QUIERO COTIZAR» SOLO DESDE EL SERVIDOR (relevo noche 30/10/2026).
-- staff_app_quiero_cotizar(slug, email) devuelve el link crudo de cotización para
-- mandarlo por mail. Estaba abierta a anon: cualquiera con la llave pública podía
-- llamarla con el mail de OTRO proveedor de una licitación pública, recibir su
-- link en la respuesta (y dejarle vencido el suyo). Ahora solo la llama la acción
-- del servidor con service_role (licitacion-actions.ts), que manda el link al mail.
--
-- ⚠️ ORDEN: aplicar DESPUÉS de que esté en producción el commit que usa
-- createServiceRoleClient() en pedirLinkParaCotizar. Antes, la página pública
-- respondería «No pudimos mandarte el link».
revoke all on function public.staff_app_quiero_cotizar(text, text, text) from public, anon, authenticated;
grant execute on function public.staff_app_quiero_cotizar(text, text, text) to service_role;
