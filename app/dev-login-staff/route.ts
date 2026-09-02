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
 *
 * QUÉ CUENTA Y POR QUÉ: ridaofrancorg+staff@gmail.com es el alias de prueba de
 * Franco, a propósito NO es una persona real del pool. El atajo no puede
 * impersonar a un trabajador de verdad. Si querés entrar como otra persona,
 * cambiá la constante por un mail que YA tenga ficha en staff_app.staff_profiles.
 *
 * EL BUG DEL "Unexpected end of JSON input" (2/9): no era esta ruta ni el
 * service-role. Era que LABURO_DEV_BYPASS no estaba en .env.local, así que el
 * guard de acá abajo devolvía un 404 de texto plano; el router de Next lo
 * buscaba como payload RSC, no encontraba JSON, y el browser mostraba ese error
 * en vez del 404. Si vuelve a pasar, mirá primero .env.local.
 *
 * Y EL SEGUNDO PASO: tener sesión no alcanza. /panel-staff exige ficha de staff
 * (requireStaff → staff_app_my_staff_profile) y sin ficha rebota a /acceso-staff
 * sin decir por qué. Por eso acá abajo, después de crear la sesión, se chequea la
 * ficha y se falla con un mensaje que dice exactamente qué falta. Un atajo de
 * desarrollo que se rompe tiene que contar qué le pasó: es su único trabajo.
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

  // 4. La sesión ya está. Chequear que además exista la FICHA de staff, que es lo
  //    que /panel-staff exige de verdad. Sin esto el atajo "funciona" y te deja
  //    rebotando en /acceso-staff sin ninguna explicación.
  const { data: ficha, error: fichaError } = await supabase.rpc(
    "staff_app_my_staff_profile",
  );
  if (fichaError) {
    return new NextResponse(
      `La sesión de ${STAFF_EMAIL} se creó bien, pero no se pudo leer la ficha de staff: ${fichaError.message}`,
      { status: 500 },
    );
  }
  if (!ficha) {
    return new NextResponse(
      `La sesión de ${STAFF_EMAIL} se creó bien, pero esa cuenta NO tiene ficha en ` +
        `staff_app.staff_profiles, así que /panel-staff te va a rebotar a /acceso-staff.\n\n` +
        `Salidas:\n` +
        `1. Cargá la ficha desde /sumate usando ese mismo mail.\n` +
        `2. O cambiá STAFF_EMAIL en app/dev-login-staff/route.ts por un mail que ya tenga ficha.`,
      { status: 500 },
    );
  }

  return NextResponse.redirect(
    new URL("/panel-staff", process.env.SITE_URL ?? "http://localhost:3000"),
  );
}
