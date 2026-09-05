-- Migration: staff_app_0074_suplantando_no_se_ve_el_contacto
-- Escrita el 2026-09-05.
--
-- ---------------------------------------------------------------------------
-- EL AGUJERO, Y POR QUE ES SERIO
-- ---------------------------------------------------------------------------
-- La 0073 dejo que la plataforma opere una organizacion ajena, y lib/permisos.ts
-- corta el contacto del pool mientras eso pasa. **Pero ese corte era de
-- APLICACION, no de base.**
--
-- Quien suplanta ES member/writer a nivel Postgres para esa organizacion, asi
-- que la RLS lo deja leer. La UI escondia las columnas; la API no. Cualquier
-- cliente hablando con PostgREST con ese JWT y pidiendo
-- `select=email,telefono,documento` recibia los datos igual.
--
-- Reproducido contra produccion antes de escribir esto: con una suplantacion
-- viva, `SELECT nombre, email, telefono, documento FROM public.staff_app_profiles`
-- devolvio los tres valores.
--
-- ⚠️ Y NO ES SOLO UN DETALLE TECNICO: los terminos de uso publicados dicen, con
-- todas las letras, que si la plataforma entra a resolver un problema "desde
-- adentro no vemos el mail, el telefono ni el documento de tu gente". Eso era
-- una promesa que la implementacion no sostenia. O se cumple en la base, o hay
-- que borrarla de los terminos. Se cumple.
--
-- ---------------------------------------------------------------------------
-- COMO SE ARREGLA
-- ---------------------------------------------------------------------------
-- El corte baja a las VISTAS, que son por donde la app lee. Con una suplantacion
-- viva, las columnas sensibles vuelven NULL.
--
-- Por que en las vistas y no en la RLS: Postgres no tiene RLS por columna. La
-- alternativa seria sacar a la organizacion suplantada del EXISTS de
-- is_org_member, pero eso rompe la suplantacion entera (no podria ver ni los
-- eventos). Enmascarar la columna es lo que corta exactamente lo que hay que
-- cortar.
--
-- ⚠️ Las tres vistas van juntas. Enmascarar solo `staff_app_profiles` y dejar
-- `staff_app_postulaciones` abierta seria peor que no hacer nada: daria la
-- sensacion de estar cerrado con la puerta de al lado abierta.
--
-- ---------------------------------------------------------------------------
-- EL EFECTO COLATERAL, ACEPTADO Y ESCRITO
-- ---------------------------------------------------------------------------
-- El mail de una oferta se manda con la direccion que viaja DESDE EL CLIENTE
-- (offer-actions.ts, `input.email`). Suplantando, esa direccion ahora llega
-- vacia, asi que la oferta se crea y el mail sale como 'none', que es el estado
-- honesto que ese archivo ya contempla.
--
-- Es la consecuencia correcta: **suplantando no se le manda un mail al staff de
-- otra productora en su nombre.** Si algun dia hace falta, el arreglo NO es
-- reabrir la columna: es que la RPC resuelva la direccion del lado del servidor
-- y mande el mail sin que el cliente la vea nunca.

BEGIN;

-- ---------------------------------------------------------------------------
-- (1) LA PREGUNTA, EN UN SOLO LUGAR
-- ---------------------------------------------------------------------------
-- Misma ventana de 60 minutos que los gates de la 0073. Vive en una funcion y
-- no repetida en cada vista para que el dia que cambie, cambie una sola vez.
CREATE OR REPLACE FUNCTION staff_app.suplantando()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM staff_app.impersonation_log l
     WHERE l.actor_user_id = auth.uid()
       AND l.terminada_at IS NULL
       AND l.iniciada_at > now() - interval '60 minutes'
  );
$function$;

REVOKE ALL ON FUNCTION staff_app.suplantando() FROM public;
GRANT EXECUTE ON FUNCTION staff_app.suplantando() TO authenticated;

COMMENT ON FUNCTION staff_app.suplantando() IS
  'True si el caller esta operando una organizacion ajena con una sesion de suplantacion viva (0073). La usan las vistas para enmascarar datos personales. Es STABLE, asi que Postgres la evalua una vez por consulta y no una por fila.';

-- ---------------------------------------------------------------------------
-- (2) LAS TRES VISTAS. Cuerpo vigente + el enmascarado. Nada mas cambia.
-- ---------------------------------------------------------------------------

-- (2.1) El pool. La mas importante: son 1.050 personas.
CREATE OR REPLACE VIEW public.staff_app_profiles
WITH (security_invoker = true) AS
  SELECT id,
    nombre,
    apellido,
    oficios,
    oficios_otro,
    provincia,
    ciudad,
    experiencia,
    anios_experiencia,
    eventos_trabajados,
    experiencia_detalle,
    disponibilidad_finde,
    disponibilidad_viajar,
    movilidad_propia,
    disponibilidad_aviso,
    estado,
    -- El PDF del CV lleva el contacto ADENTRO, asi que enmascarar el mail y
    -- dejar el link seria dejar la puerta abierta al lado de la ventana
    -- cerrada. Lo mismo con cv_data, que es el CV ya parseado.
    CASE WHEN staff_app.suplantando() THEN NULL ELSE cv_url END   AS cv_url,
    -- portfolio_url y linkedin_url NO se enmascaran: son perfiles que la
    -- persona publica a proposito.
    portfolio_url,
    linkedin_url,
    CASE WHEN staff_app.suplantando() THEN NULL ELSE telefono END AS telefono,
    CASE WHEN staff_app.suplantando() THEN NULL ELSE email END    AS email,
    situacion_legal,
    donde_trabajar,
    pais_residencia,
    motivacion,
    organization_id,
    CASE WHEN staff_app.suplantando() THEN NULL ELSE documento END        AS documento,
    CASE WHEN staff_app.suplantando() THEN NULL ELSE fecha_nacimiento END AS fecha_nacimiento,
    CASE WHEN staff_app.suplantando() THEN NULL ELSE cv_data END          AS cv_data
   FROM staff_app.staff_profiles
  WHERE (baja_at IS NULL);

COMMENT ON VIEW public.staff_app_profiles IS
  'El pool de staff. Con una suplantacion viva (0073/0074) devuelve NULL en email, telefono, documento, fecha de nacimiento, cv_url y cv_data: entrar a resolverle un problema a una productora no requiere ver el documento de su gente, y los terminos de uso lo prometen.';

-- (2.2) Las postulaciones traen la ficha completa por JOIN. Misma PII, misma
--       regla: si esta abierta, el corte de arriba no sirve de nada.
CREATE OR REPLACE VIEW public.staff_app_postulaciones
WITH (security_invoker = true) AS
  SELECT a.id,
    a.organization_id,
    a.opening_id,
    a.staff_profile_id,
    a.estado,
    a.mensaje,
    a.created_at,
    o.gig_id,
    o.role,
    o.cupo,
    o.pago,
    sp.nombre,
    sp.apellido,
    CASE WHEN staff_app.suplantando() THEN NULL ELSE sp.email END    AS email,
    CASE WHEN staff_app.suplantando() THEN NULL ELSE sp.telefono END AS telefono,
    sp.ciudad,
    sp.provincia,
    sp.oficios,
    sp.eventos_trabajados,
    CASE WHEN staff_app.suplantando() THEN NULL ELSE sp.cv_url END   AS cv_url
   FROM ((staff_app.gig_applications a
     JOIN staff_app.gig_openings o ON ((o.id = a.opening_id)))
     JOIN staff_app.staff_profiles sp ON ((sp.id = a.staff_profile_id)));

-- (2.3) Los leads de la landing. Hoy los ve solo la plataforma, pero son datos
--       de contacto de personas que dejaron su mail: misma regla.
CREATE OR REPLACE VIEW public.staff_app_producer_leads
WITH (security_invoker = true) AS
  SELECT id,
    nombre,
    empresa,
    CASE WHEN staff_app.suplantando() THEN NULL ELSE email END    AS email,
    CASE WHEN staff_app.suplantando() THEN NULL ELSE telefono END AS telefono,
    mensaje,
    origen,
    estado,
    contactado_at,
    created_at,
    organization_id
   FROM staff_app.producer_leads;

COMMIT;

-- ---------------------------------------------------------------------------
-- COMO SE COMPRUEBA (y como se comprobo)
-- ---------------------------------------------------------------------------
--   BEGIN;
--   INSERT INTO staff_app.impersonation_log (actor_user_id, organization_id, motivo)
--   VALUES ('<el admin>', '<una org ajena>', 'prueba');
--   SET LOCAL role authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<el admin>","role":"authenticated"}';
--   SELECT email, telefono, documento FROM public.staff_app_profiles LIMIT 1;
--   -- los tres tienen que volver NULL
--   ROLLBACK;
--
-- Y sin suplantacion, los tres tienen que seguir viniendo con su valor: si el
-- enmascarado se come el caso normal, el producto deja de funcionar entero.
