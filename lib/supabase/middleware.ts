import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresca la sesión de Supabase en cada request y redirige a /login
 * a los usuarios no autenticados (salvo rutas públicas).
 * Copiado de HITO (lib/supabase/middleware.ts) sin la maquinaria de i18n.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Rutas públicas: el landing "/" (match exacto) + "/sumate" (registro) + las de
  // auth/oferta. El resto de la app (/buscar, /staff, /tablero) queda gateada.
  const path = request.nextUrl.pathname;
  const publicPrefixes = [
    // La puerta unica (5/8). Publica por definicion: es donde se entra.
    // /login y /acceso-staff siguen andando abajo, no se retiran.
    "/entrar",
    "/login",
    "/acceso-staff",
    // Alta abierta de productora (Fase 2, 2/8). Publica por definicion: la
    // productora que llega todavia no tiene cuenta. El gate no existe a
    // proposito (decision de Franco: "que quede abierto"), y el freno de abuso
    // vive en el server action.
    "/registrar-productora",
    // Alta abierta de proveedor (3/8). Publica por la misma razon: el proveedor
    // que llega no tiene cuenta y NUNCA la va a tener, entra siempre por link
    // magico. El freno de abuso vive en el server action, y la RPC esta
    // granteada solo a service_role.
    "/registrar-proveedor",
    // Alta abierta de SALON (cuarto pool, 6/8). Identica al alta del proveedor
    // en todo lo que importa acá: el que llega no tiene cuenta, el freno de
    // abuso vive en el server action y la RPC esta granteada solo a
    // service_role.
    "/registrar-salon",
    "/auth/callback",
    "/dev-login",
    "/o",
    "/sumate",
    "/api/parse-cv",
    // Bienvenida de una ficha recien creada. La llama somosder.ar despues de
    // registrar a alguien, SIN sesion (esa persona todavia no tiene cuenta). Sin
    // esto el middleware la mandaria a /login con un 307 mudo y el mail no
    // saldria nunca, que es exactamente el agujero que vino a tapar. El gate
    // real vive adentro: uuid de la ficha + ventana de 30 minutos + la marca
    // bienvenida_enviada_at, que la hace idempotente.
    "/api/bienvenida",
    "/api/mp/webhook",
    // Crons de Vercel: llegan SIN sesión (no hay usuario), así que sin esto el
    // middleware los redirigía a /login y el cron "corría" con un 307 a una
    // pantalla de login, sin ejecutar nada y sin fallar ruidosamente. Dejarlos
    // pasar acá es seguro: cada route valida el bearer CRON_SECRET fail-closed y
    // devuelve 401 si no coincide.
    "/api/cron",
    // Puerta de entrada del proveedor (marketplace, movimiento 2). El proveedor
    // llega desde un link que le pasó la productora, SIN cuenta y sin sesión: si
    // el middleware lo mandara a /login, no podría entrar nunca. El gate real es
    // el token, que validan adentro las RPCs SECURITY DEFINER de la 0042 (hash,
    // vencimiento, tipo proveedor y activo), no esta lista.
    // ⚠️ El prefijo va ENTERO. Esta lista se evalúa con startsWith, así que un
    // prefijo corto tipo "/p", "/pr" o "/prov" abriría "/pagos" y "/panel-staff"
    // al mundo sin sesión, y además "/prov" chocaría con el "/proveedores" del
    // directorio cuando exista.
    "/acceso-proveedor",
    // Baja del pool ("no quiero formar parte"): la persona llega desde el pie de
    // un mail, sin cuenta y sin sesión. El gate es el token HMAC del link, que
    // valida la propia página/route (lib/baja.ts), no el middleware.
    "/baja",
    "/api/baja",
    // ⚠️ CREAR O CAMBIAR LA CONTRASEÑA. Va acá SÍ O SÍ: la persona llega desde el
    // link del mail SIN sesión todavía (la sesión se crea recién al canjear el
    // code en /definir-contrasena/confirmar). Sin esta línea el middleware la
    // mandaría a /login y NADIE podría definir su contraseña, que es exactamente
    // el bug que tuvo muerto meses al cron de recordatorios.
    // Dejarlo pasar es seguro: el gate real es el code de Supabase, que se canjea
    // en el route handler, y la acción de guardar exige sesión.
    "/definir-contrasena",
    // Pantallas del lado staff (standalone, chrome propio). El middleware las deja
    // pasar y el gate real lo hace cada página con requireStaff() (fork "staff con
    // cuenta"): sin sesión o sin perfil de staff → redirige a /acceso-staff.
    "/fichaje",
    "/panel-staff",
    "/onboarding-staff",
    "/editar-perfil-staff",
    // Marketplace del lado de la persona (0052). Va en esta lista por el mismo
    // motivo que sus hermanas: sin esto, el middleware manda a /login, que es la
    // puerta del PRODUCTOR, y el staff termina en una pantalla que no es la
    // suya. El gate real lo hace la página con requireStaff(), que redirige a
    // /acceso-staff, y los RPC de la 0052 no le contestan a nadie que no tenga
    // ficha en el pool.
    "/trabajos",
    // Blog público (/blog y /blog/<slug>): contenido estático, sin sesión. Sin
    // esta línea el middleware mandaría a /login a cualquiera que llegue desde
    // Google — o sea, a todo el tráfico que el blog existe para captar.
    "/blog",
    // LA VIDRIERA DE PROVEEDORES (Fase 4, migración 0059). Es la puerta del
    // cliente final: alguien que organiza su casamiento y que no tiene ni va a
    // tener cuenta. Sin esta línea la fase entera es inalcanzable, que es
    // exactamente lo que pasó al probarla la primera vez (307 a /login).
    //
    // ⚠️ NO confundir con "/proveedores", que es la pantalla de la productora y
    // tiene que seguir gateada. Son dos rutas distintas a propósito: la de
    // adentro trae favoritos y notas internas de cada productora, la de afuera
    // no trae nada de eso ni el mail del proveedor.
    //
    // Dejarla pasar es seguro: las RPC `staff_app_vidriera_*` son SECURITY
    // DEFINER, solo miran proveedores publicados, no devuelven datos de
    // contacto, y la de consultar tiene el freno de abuso adentro.
    "/servicios",
    // LA VIDRIERA DE SALONES (cuarto pool, migraciones 0064/0066/0067). Misma
    // razón exacta que "/servicios": es la puerta del cliente final, alguien que
    // busca dónde hacer su fiesta y que no tiene ni va a tener cuenta. Sin esta
    // línea el pool entero es inalcanzable con un 307 mudo a /entrar, que es lo
    // que ya pasó la primera vez que se probó la vidriera de proveedores.
    //
    // Dejarla pasar es seguro por lo mismo: `staff_app_vidriera_salones` y
    // `staff_app_vidriera_salon` son SECURITY DEFINER, solo miran salones
    // publicados, no devuelven mail ni teléfono, y la de consultar tiene el
    // freno de abuso de tres capas adentro.
    "/salones",
    // El matcher del middleware solo excluye imágenes y .js, así que /robots.txt
    // y /sitemap.xml pasan por acá: sin esta línea, Googlebot pide el sitemap y
    // se come un 307 a /login.
    "/robots.txt",
    "/sitemap.xml",
  ];
  const isPublic = path === "/" || publicPrefixes.some((p) => path.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    // A /entrar y no a /login (5/8): /login es la puerta de UN actor, y quien
    // rebota acá puede ser cualquiera de los tres. Mandarlo a la pantalla de
    // productoras es como empezo todo el lio de "no se por donde entro".
    url.pathname = "/entrar";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
