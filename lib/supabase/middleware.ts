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
    "/login",
    "/acceso-staff",
    "/auth/callback",
    "/dev-login",
    "/o",
    "/sumate",
    "/api/parse-cv",
    "/api/mp/webhook",
    // Crons de Vercel: llegan SIN sesión (no hay usuario), así que sin esto el
    // middleware los redirigía a /login y el cron "corría" con un 307 a una
    // pantalla de login, sin ejecutar nada y sin fallar ruidosamente. Dejarlos
    // pasar acá es seguro: cada route valida el bearer CRON_SECRET fail-closed y
    // devuelve 401 si no coincide.
    "/api/cron",
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
  ];
  const isPublic = path === "/" || publicPrefixes.some((p) => path.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
