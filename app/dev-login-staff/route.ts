import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

/**
 * ATAJO DE DESARROLLO — SOLO LOCAL. Entra como la CUENTA DE STAFF DE PRUEBA sin
 * contraseña ni magic link, para probar el lado staff (panel / fichaje / perfil)
 * sin depender del email de Supabase ni de la lista de redirects.
 *
 * Igual que /dev-login pero con el email de staff sembrado: se asegura de que el
 * auth.user exista (createUser idempotente), genera un magic-link server-side
 * (generateLink), lo verifica para setear cookies y cae en /panel-staff. Se
 * activa SOLO con LABURO_DEV_BYPASS=1 y NODE_ENV != production (en Vercel: 404).
 */

const STAFF_EMAIL = "ridaofrancorg+staff@gmail.com";

export async function GET() {
  if (
    process.env.LABURO_DEV_BYPASS !== "1" ||
    process.env.NODE_ENV === "production"
  ) {
    return new NextResponse("Not found", { status: 404 });
  }

  const admin = createServiceRoleClient();

  // 1. Asegurar que exista el auth.user del staff de prueba (idempotente).
  const { error: createErr } = await admin.auth.admin.createUser({
    email: STAFF_EMAIL,
    email_confirm: true,
  });
  // "already registered" es esperado si ya se creó antes: se ignora.
  if (createErr && !/already|registered|exists/i.test(createErr.message)) {
    return new NextResponse(
      `No se pudo preparar el usuario staff: ${createErr.message}`,
      { status: 500 },
    );
  }

  // 2. Magic-link server-side (no manda email, no usa redirect allowlist).
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: STAFF_EMAIL,
  });
  if (linkError || !link?.properties?.hashed_token) {
    return new NextResponse(
      `No se pudo generar el acceso staff: ${linkError?.message ?? "sin token"}`,
      { status: 500 },
    );
  }

  // 3. Verificar el token con el cliente SSR para setear las cookies de sesión.
  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: link.properties.hashed_token,
  });
  if (verifyError) {
    return new NextResponse(
      `No se pudo iniciar la sesión staff: ${verifyError.message}`,
      { status: 500 },
    );
  }

  return NextResponse.redirect(
    new URL("/panel-staff", process.env.SITE_URL ?? "http://localhost:3000"),
  );
}
