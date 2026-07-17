import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

/**
 * ATAJO DE DESARROLLO — SOLO LOCAL. Entra como admin sin contraseña.
 *
 * Se activa UNICAMENTE si LABURO_DEV_BYPASS === "1" (que vive solo en .env.local,
 * gitignoreado, y NO existe en Vercel). En producción devuelve 404.
 *
 * Cómo funciona sin tocar Supabase: el service-role genera un magic-link
 * server-side (generateLink, no manda mail, no depende de la lista de redirects)
 * y con ese token se crea una sesión real del admin ya sembrado. Así toda la app
 * corre igual que con login real (RLS lo ve como miembro, los datos cargan), pero
 * vos entrás directo. Borrá esta ruta antes de cualquier deploy serio.
 */

const ADMIN_EMAIL = "ridaofrancorg@gmail.com";

export async function GET() {
  if (
    process.env.LABURO_DEV_BYPASS !== "1" ||
    process.env.NODE_ENV === "production"
  ) {
    return new NextResponse("Not found", { status: 404 });
  }

  const admin = createServiceRoleClient();

  // 1. Generar un magic-link server-side (no envía email, no usa redirect allowlist).
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: ADMIN_EMAIL,
  });

  if (linkError || !link?.properties?.hashed_token) {
    return new NextResponse(
      `No se pudo generar el acceso admin: ${linkError?.message ?? "sin token"}`,
      { status: 500 },
    );
  }

  // 2. Verificar el token con el cliente SSR para que setee las cookies de sesión.
  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: link.properties.hashed_token,
  });

  if (verifyError) {
    return new NextResponse(
      `No se pudo iniciar la sesión admin: ${verifyError.message}`,
      { status: 500 },
    );
  }

  // 3. Adentro.
  return NextResponse.redirect(new URL("/dashboard", process.env.SITE_URL ?? "http://localhost:3000"));
}
