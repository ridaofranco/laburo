-- Migration: staff_app_0072_categoria_de_productora
-- Escrita el 2026-09-05. SIN APLICAR: la aplica Franco.
--
-- Agrega staff_app.organizations.categoria, para que /plataforma pueda decir
-- QUE TIPO de organizacion es cada una y filtrar por eso.
--
-- ---------------------------------------------------------------------------
-- CONTEXTO HONESTO: ESTO OPERA SOBRE DOS FILAS
-- ---------------------------------------------------------------------------
-- Hoy hay dos organizaciones (mas la de prueba, si sigue puesta). La columna se
-- suma igual porque es barata y porque el dia que entren diez ya va a estar; lo
-- que NO se hace es sobre-disenarla. No hay tabla de categorias, no hay
-- jerarquia, no hay orden configurable: es una columna de texto con un CHECK.
--
-- ---------------------------------------------------------------------------
-- LISTA CERRADA, Y POR QUE ESO NO CONTRADICE LA DECISION DEL 2/9
-- ---------------------------------------------------------------------------
-- ⚠️ Hay una decision de Franco que a primera vista dice lo contrario. En
-- app/registrar-productora/registro-client.tsx esta escrito:
--
--     "texto libre y NO una lista de chips: la puerta se acaba de abrir a
--      agencias, marcas y particulares, y una taxonomia cerrada los volveria a
--      dejar afuera."
--
-- Esa decision sigue en pie y NO se toca. Son dos campos distintos:
--
--   - "Que eventos hace" lo escribe QUIEN SE ANOTA, en el formulario de alta,
--     y va libre porque cerrarlo deja gente afuera de la puerta. Ese es el caso
--     que Franco decidio.
--   - `categoria` la carga LA PLATAFORMA, despues, desde adentro. No la ve ni la
--     escribe quien se anota, no filtra a nadie en el alta, y existe para poder
--     agrupar y filtrar. Un filtro sobre texto libre no filtra: en seis meses
--     hay "Productora", "productora" y "Prod." y la pantalla miente.
--
-- O sea: la puerta sigue abierta a cualquiera, y la clasificacion es interna.
--
-- ---------------------------------------------------------------------------
-- DE DONDE SALE EL VOCABULARIO
-- ---------------------------------------------------------------------------
-- No se invento: son los cinco tipos de cliente que el propio producto ya
-- nombra desde que se abrio la puerta de alta (commit 7e1dbb7, 2/9):
-- productoras, agencias, marcas, empresas y particulares.
--
-- ⚠️ Los valores van SIN acentos, como toda esta carpeta. Ninguno de los cinco
-- los necesita, asi que no hay trampa aca; la etiqueta linda para mostrar vive
-- en el TypeScript, que si lleva acentos. No se mezclan.

BEGIN;

-- ---------------------------------------------------------------------------
-- (1) LA COLUMNA. Nullable y SIN default.
-- ---------------------------------------------------------------------------
-- No se le inventa una categoria a las filas que ya existen. "No se sabe" es un
-- dato: ponerle 'productora' a la organizacion huerfana seria escribir una
-- mentira en la base. NULL significa sin clasificar, y la pantalla lo dice asi.
ALTER TABLE staff_app.organizations
  ADD COLUMN IF NOT EXISTS categoria text;

-- ⚠️ NULL TIENE que pasar el CHECK, si no el ADD CONSTRAINT aborta contra las
-- filas que ya existen (que son todas).
ALTER TABLE staff_app.organizations
  DROP CONSTRAINT IF EXISTS organizations_categoria_check;

ALTER TABLE staff_app.organizations
  ADD CONSTRAINT organizations_categoria_check
  CHECK (categoria IS NULL OR categoria IN
    ('productora','agencia','marca','empresa','particular'));

COMMENT ON COLUMN staff_app.organizations.categoria IS
  'Que tipo de organizacion es, para agrupar y filtrar en /plataforma. Lista cerrada: productora, agencia, marca, empresa, particular. NULL = sin clasificar, y es el estado inicial de todas. CLASIFICACION INTERNA: no la ve ni la escribe quien se anota, y no filtra a nadie en la puerta de alta, que sigue abierta a cualquiera. SE CARGA A MANO con un UPDATE, igual que es_plataforma y is_default: no hay pantalla ni RPC para escribirla, a proposito, porque con esta cantidad de organizaciones un formulario es superficie nueva sin uso. Los valores van sin acentos; la etiqueta que se muestra vive en el TypeScript.';

-- ---------------------------------------------------------------------------
-- (2) LA RPC, re-emitida ENTERA con su cuerpo vigente + el campo nuevo.
-- ---------------------------------------------------------------------------
-- Cuerpo extraido de produccion con pg_get_functiondef antes de tocarlo. Lo
-- unico que cambia es la linea de 'categoria'.
CREATE OR REPLACE FUNCTION public.staff_app_plataforma_organizaciones()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'staff_app', 'pg_temp'
AS $function$
BEGIN
  IF NOT staff_app.is_platform_admin() THEN RETURN '[]'::jsonb; END IF;

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', org.id,
      'name', org.name,
      'slug', org.slug,
      'activa', org.activa,
      'es_plataforma', org.es_plataforma,
      'categoria', org.categoria,
      'created_at', org.created_at,
      'miembros',  (SELECT count(*) FROM staff_app.members m WHERE m.organization_id = org.id),
      'eventos',   (SELECT count(*) FROM staff_app.gigs g WHERE g.organization_id = org.id),
      'busquedas', (SELECT count(*) FROM staff_app.gig_openings o WHERE o.organization_id = org.id),
      'contrataciones', (SELECT count(*) FROM staff_app.offers of WHERE of.organization_id = org.id AND of.status = 'accepted')
    ) ORDER BY org.created_at ASC)
    FROM staff_app.organizations org
  ), '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_app_plataforma_organizaciones() FROM public;
GRANT EXECUTE ON FUNCTION public.staff_app_plataforma_organizaciones() TO authenticated, service_role;

COMMIT;

-- ---------------------------------------------------------------------------
-- COMO SE CARGA (para Franco, despues de aplicar)
-- ---------------------------------------------------------------------------
-- A mano, con un UPDATE acotado. No hay formulario y no se busque uno:
--
--   UPDATE staff_app.organizations SET categoria = 'productora'
--    WHERE slug = 'somos-der';        -- WHERE acotado, un slug por vez
--
-- Y para ver como quedo:
--
--   SELECT name, slug, categoria FROM staff_app.organizations ORDER BY created_at;
--
-- La pantalla muestra "sin clasificar" en las que sigan en NULL, y el filtro de
-- categorias recien aparece cuando haya mas de una categoria cargada.
