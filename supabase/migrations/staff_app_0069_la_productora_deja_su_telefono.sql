-- staff_app_0069_la_productora_deja_su_telefono
--
-- LA UNICA PUNTA SIN CANAL DE RECUPERACION.
--
-- El alta de productora pedia dos campos: nombre y email. Las otras tres altas
-- del sistema piden telefono (/sumate pide 18 campos mas CV, /registrar-salon
-- 13, /registrar-proveedor 9). La productora, que es la punta que da volumen, no.
--
-- Que significa eso en la practica: si el mail de bienvenida no le llega (y no
-- llega mas seguido de lo que uno quisiera: casilla llena, spam, un typo en el
-- dominio), NO HAY forma de recuperar a esa productora. Se anoto, quedo creada
-- en la base, y del otro lado hay alguien esperando un mail que nunca va a
-- abrir. El telefono es lo unico que convierte eso en una llamada de dos
-- minutos.
--
-- Por eso el telefono SI se persiste y los otros dos datos nuevos que pide el
-- formulario (que eventos arma, cuantos por anio) NO: esos son cualitativos,
-- sirven para la primera conversacion, ninguna pantalla los consume, y van en el
-- aviso de Telegram. El telefono es dato de RECUPERACION: si vive solo en un
-- mensaje de Telegram no existe cuando hace falta, y /plataforma no podria
-- mostrarlo nunca.
--
-- ── POR QUE EL PARAMETRO ES OPCIONAL (p_telefono text DEFAULT NULL) ──────────
-- DECISION DE FRANCO, Y NO SE "ARREGLA" VOLVIENDOLO OBLIGATORIO.
--
-- Con el parametro obligatorio, esta migracion y el deploy del codigo quedaban
-- atados: aplicar la migracion antes rompia el codigo viejo (que llama con dos
-- argumentos), y deployar el codigo antes rompia el alta (que llamaria con tres
-- contra una funcion de dos). Cualquiera de los dos ordenes dejaba una ventana
-- con el alta de productora rota.
--
-- Con el DEFAULT NULL no hay ventana: una llamada de DOS argumentos (el codigo
-- que hoy corre en produccion) resuelve contra esta funcion, y una de TRES
-- tambien. El orden de deploy deja de importar. Si alguna vez el telefono tiene
-- que ser obligatorio de verdad, el lugar es la validacion del server action, no
-- la firma de la funcion.
--
-- ⚠️ Y POR ESO EL DROP DE LA VERSION VIEJA NO ES OPCIONAL. Si quedaran vivas la
-- funcion de 2 argumentos Y esta de 3 con default, una llamada de 2 argumentos
-- se vuelve AMBIGUA y Postgres tira error: se romperia justo lo que el default
-- vino a proteger. Se dropea explicitamente la firma (text, text) antes de crear
-- la nueva, igual que hace la 0036 con create_gig, update_gig, set_gig_details,
-- set_gig_slots, set_gig_payment_pref y create_offer.
--
-- Al hacer DROP se van los grants viejos, asi que el REVOKE/GRANT y el COMMENT
-- de abajo se re-emiten con la firma NUEVA de tres parametros. Sin eso el alta
-- queda muerta para service_role, que es el unico que la puede llamar.

-- 1. La columna. Idempotente: si la migracion se corre dos veces no pasa nada.
ALTER TABLE staff_app.organizations ADD COLUMN IF NOT EXISTS telefono text;

COMMENT ON COLUMN staff_app.organizations.telefono IS
  'Telefono / WhatsApp de quien dio de alta la cuenta (0069). Es el canal de RECUPERACION: sin esto, una productora a la que no le llego el mail de bienvenida se pierde para siempre. Lo pide /registrar-productora como campo obligatorio.';

-- 2. Fuera la version de dos parametros, antes de crear la de tres. Sin este
--    DROP, una llamada de dos argumentos queda ambigua entre las dos firmas.
DROP FUNCTION IF EXISTS public.staff_app_crear_productora(text, text);

CREATE OR REPLACE FUNCTION public.staff_app_crear_productora(
  p_nombre   text,
  p_email    text,
  p_telefono text DEFAULT NULL   -- opcional a proposito: ver el header
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'staff_app', 'pg_temp'
AS $$
DECLARE
  v_nombre   text := btrim(coalesce(p_nombre, ''));
  v_email    text := lower(btrim(coalesce(p_email, '')));
  v_telefono text := nullif(btrim(coalesce(p_telefono, '')), '');
  v_slug     text;
  v_base     text;
  v_n        int := 1;
  v_org      uuid;
BEGIN
  IF v_nombre = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'falta_nombre');
  END IF;
  IF v_email = '' OR v_email NOT LIKE '%@%.%' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'falta_email');
  END IF;

  -- Si ese mail YA es miembro de alguna organizacion, no se crea nada. Sin esto,
  -- alguien que se olvido de que tenia cuenta termina con dos productoras y sus
  -- eventos partidos entre las dos.
  IF EXISTS (
    SELECT 1 FROM staff_app.members m
     JOIN auth.users u ON u.id = m.user_id
    WHERE lower(u.email) = v_email
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'ya_tiene_cuenta');
  END IF;

  -- Idem si ya tiene invitacion pendiente (se registro y todavia no entro). Se
  -- devuelve ok para que el server action le vuelva a mandar el mail: el caso
  -- normal de registrarse dos veces es "no me llego".
  SELECT i.organization_id INTO v_org
    FROM staff_app.member_invites i
   WHERE lower(i.email) = v_email
   LIMIT 1;
  IF v_org IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'organization_id', v_org, 'ya_existia', true);
  END IF;

  -- Slug legible y unico. Se usa en URLs y en p_org_slug del alta de staff, asi
  -- que no puede chocar. translate() saca los acentos sin extensiones.
  -- ⚠️ El primer literal de translate() TIENE que llevar los acentos: es la
  -- tabla de origen, no prosa. Copiado tal cual de la 0056, no tocar.
  v_base := regexp_replace(
              regexp_replace(
                lower(translate(v_nombre,
                  'áàäâãÁÀÄÂÃéèëêÉÈËÊíìïîÍÌÏÎóòöôõÓÒÖÔÕúùüûÚÙÜÛñÑçÇ',
                  'aaaaaAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUnNcC')),
                '[^a-z0-9]+', '-', 'g'),
              '(^-+|-+$)', '', 'g');
  IF v_base = '' THEN v_base := 'productora'; END IF;
  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM staff_app.organizations o WHERE o.slug = v_slug) LOOP
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  END LOOP;

  -- (0069) El telefono entra con la organizacion.
  INSERT INTO staff_app.organizations (name, slug, activa, es_plataforma, is_default, telefono)
  VALUES (v_nombre, v_slug, true, false, false, v_telefono)
  RETURNING id INTO v_org;

  -- La invitacion: cuando entre, provision_member la lee y lo hace owner.
  INSERT INTO staff_app.member_invites (organization_id, email, role)
  VALUES (v_org, v_email, 'owner');

  RETURN jsonb_build_object('ok', true, 'organization_id', v_org, 'slug', v_slug, 'ya_existia', false);
END;
$$;

-- 3. Los grants, con la firma NUEVA. El DROP de arriba se llevo los viejos.
REVOKE ALL ON FUNCTION public.staff_app_crear_productora(text, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_app_crear_productora(text, text, text) TO service_role;
COMMENT ON FUNCTION public.staff_app_crear_productora(text, text, text) IS
  'Alta abierta de productora (Fase 2, decision de Franco 2/8). Crea la organizacion y le deja la invitacion de owner a su mail; cuando entra, provision_member hace el resto. Desde la 0069 guarda tambien el telefono, que es el canal de recuperacion si el mail no llega. p_telefono es OPCIONAL a proposito para que el deploy no dependa del orden: una llamada de dos argumentos sigue resolviendo. SOLO service_role.';
