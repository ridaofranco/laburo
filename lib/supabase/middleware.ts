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
