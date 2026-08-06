"use server";

/**
 * Registro nativo de staff en la plataforma (arista "registro para trabajar").
 * Escribe al MISMO pool que somosder.ar llamando el MISMO RPC SECURITY DEFINER
 * public.staff_app_register_applicant (anon). Si adjuntan CV, se sube al bucket
 * privado staff-cvs con service-role (server-only) y se guarda el path como cv_url.
 * Un solo producto, dos aristas: el registro entra igual desde la web o desde acá.
 */

import { createElement } from "react";
import { render } from "@react-email/components";
import { oficios } from "@/lib/data/oficios";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { CV_BUCKET } from "@/lib/cv";
import { verificarCvSubido } from "@/lib/cv-servidor";
import { sendMail } from "@/lib/email/mailer";
import { WelcomeEmail } from "@/components/emails/welcome-email";
import { siteUrl } from "@/lib/site";
import { bajaHeaders, bajaReady, bajaUrl } from "@/lib/baja";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { linkParaElegirContrasena } from "@/lib/auth-link";



/**
 * Catálogo cerrado de oficios, aplanado una sola vez. En la vía corta (registro
 * con el CV) el array de oficios lo arma un modelo de lenguaje leyendo el PDF,
 * o sea es salida de IA y no input elegido por la persona: solo pasan al RPC los
 * valores que existen en el catálogo. En el formulario largo salen de checkboxes
 * y el filtro es un no-op.
 */
const OFICIOS_VALIDOS = new Set(oficios.flatMap((g) => g.items.map((it) => it.es)));

/** Texto seguro: la clave puede no venir en el payload corto. */
function txt(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Array de strings seguro: idem, y descarta lo que no sea texto. */
function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/**
 * Todo opcional salvo lo que el servidor exige (nombre, email, consentimiento).
 * El registro corto manda un payload con tres o cuatro claves, así que asumir
 * que están todas era un TypeError esperando: se leen siempre con txt()/arr().
 */
export interface RegisterInput {
  nombre?: string;
  apellido?: string;
  email?: string;
  telefono?: string;
  documento?: string;
  fecha_nacimiento?: string | null;
  pais_residencia?: string;
  provincia?: string;
  ciudad?: string;
  donde_trabajar?: string[];
  situacion_legal?: string;
  oficios?: string[];
  oficios_otro?: string;
  experiencia?: boolean | null;
  anios_experiencia?: string;
  experiencia_detalle?: string;
  disponibilidad_finde?: boolean;
  disponibilidad_viajar?: boolean;
  movilidad_propia?: boolean;
  disponibilidad_aviso?: string;
  linkedin_url?: string;
  portfolio_url?: string;
  motivacion?: string;
  consentimiento?: boolean;
  /** Por dónde entró la ficha. Decide el gate del perfil confirmado (ver abajo). */
  modo?: "rapido" | "completo";
}

export async function registerApplicant(
  formData: FormData,
): Promise<{ ok: boolean; reason?: string }> {
  const raw = formData.get("payload");
  if (typeof raw !== "string") return { ok: false, reason: "Datos inválidos." };
  let input: RegisterInput;
  try {
    const parsed: unknown = JSON.parse(raw);
    // "null", "3" o "[]" parsean bien y después revientan al leer una clave.
    // Un payload que no es un objeto es un payload inválido, no un 500.
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ok: false, reason: "Datos inválidos." };
    }
    input = parsed as RegisterInput;
  } catch {
    return { ok: false, reason: "Datos inválidos." };
  }
  const nombre = txt(input.nombre);
  const email = txt(input.email);
  if (!nombre || !email) {
    return { ok: false, reason: "Nombre y email son obligatorios." };
  }
  // Consentimiento Ley 25.326 validado también en el servidor: el check del
  // browser se puede saltear, así que sin consentimiento explícito no se guarda
  // ningún dato personal.
  if (input.consentimiento !== true) {
    return { ok: false, reason: "Necesitás aceptar el tratamiento de datos." };
  }

  // ── FRENO DE ABUSO ──
  // Esta acción es pública y hace tres cosas caras: escribe una ficha, sube un
  // archivo de hasta 10MB al bucket, y MANDA UN MAIL. O sea que un script puede
  // llenar el pool de basura y, peor, hacer que LABURO le mande bienvenidas a
  // casillas ajenas hasta quemar la cuota de envío, que es compartida con el
  // resto de los productos. /acceso-staff ya tenía este freno desde el Lote 2;
  // /sumate quedó sin él.
  //
  // Los números salen del uso real: una persona se registra UNA vez, dos si se
  // equivocó y volvió a empezar. El límite por hora existe para el caso legítimo
  // de varias personas anotándose desde el mismo lugar (un evento, un locutorio).
  const ip = await clientIp();
  if (!rateLimit(`sumate:ip:${ip}`, 3, 60_000).ok) {
    return { ok: false, reason: "Esperá un minuto y volvé a intentar." };
  }
  if (!rateLimit(`sumate:ip-hora:${ip}`, 15, 3_600_000).ok) {
    return { ok: false, reason: "Demasiados registros desde esta conexión. Probá más tarde." };
  }
  // Y por dirección de mail, para que el mismo email no dispare una bienvenida
  // atrás de otra aunque cambien de IP.
  if (!rateLimit(`sumate:mail:${email.toLowerCase()}`, 3, 600_000).ok) {
    return { ok: false, reason: "Ya recibimos tu registro. Revisá tu casilla, incluido el spam." };
  }

  /**
   * CV opcional. YA NO LLEGA EL ARCHIVO: llega el nombre del objeto que el
   * navegador subió derecho a Supabase, más la firma que acredita que ese path
   * lo emitió este servidor (ver lib/cv-subida.ts).
   *
   * Este era el envío que "no dejaba enviar": el archivo viajaba adentro del
   * Server Action, Next lo topea y Vercel corta el body de la función en 4,5 MB,
   * así que por arriba de eso la request moría antes de llegar a este código y
   * no había ni un `reason` que devolver. Ahora acá entran dos strings.
   *
   * Lo que NO cambia: el tipo real se sigue decidiendo mirando los primeros
   * bytes del objeto ya subido, porque la URL firmada deja que el navegador
   * declare el contentType que quiera. Y si el registro falla después, el objeto
   * se borra para no dejar CVs huérfanos en el bucket.
   */
  const admin = createServiceRoleClient();
  let cvUrl: string | null = null;
  let uploadedPath: string | null = null;
  const cvPath = formData.get("cv_path");
  if (typeof cvPath === "string" && cvPath) {
    const v = await verificarCvSubido(cvPath, formData.get("cv_firma"));
    if (!v.ok) return { ok: false, reason: v.reason };
    uploadedPath = cvPath;
    cvUrl = v.cvUrl;
  }

  const oficiosSel = arr(input.oficios).filter((o) => OFICIOS_VALIDOS.has(o));
  const dondeTrabajar = arr(input.donde_trabajar);

  // Mismo RPC que la web. createClient sin sesión = cliente anon (RPC granteado a anon).
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_app_register_applicant", {
    p_nombre: nombre,
    p_apellido: txt(input.apellido) || null,
    // lowercase: toda la resolución de identidad del staff hace
    // `where lower(email) = ... order by created_at asc limit 1`. Sin normalizar
    // acá, "Franco@Gmail.com" y "franco@gmail.com" crean dos fichas y las ofertas
    // le llegan a la vieja, o sea el staff nunca las ve. Mismo bug que ENTRA ya cerró.
    p_email: email.toLowerCase(),
    p_telefono: txt(input.telefono) || null,
    p_documento: txt(input.documento) || null,
    p_fecha_nacimiento: txt(input.fecha_nacimiento) || null,
    p_pais_residencia: txt(input.pais_residencia) || null,
    p_provincia: txt(input.provincia) || null,
    p_ciudad: txt(input.ciudad) || null,
    p_donde_trabajar: dondeTrabajar.length ? dondeTrabajar : null,
    p_situacion_legal: txt(input.situacion_legal) || null,
    p_oficios: oficiosSel.length ? oficiosSel : null,
    p_oficios_otro: txt(input.oficios_otro) || null,
    p_experiencia: typeof input.experiencia === "boolean" ? input.experiencia : null,
    p_anios_experiencia: txt(input.anios_experiencia) || null,
    p_experiencia_detalle: txt(input.experiencia_detalle) || null,
    p_disponibilidad_finde: input.disponibilidad_finde === true,
    p_disponibilidad_viajar: input.disponibilidad_viajar === true,
    p_movilidad_propia: input.movilidad_propia === true,
    p_disponibilidad_aviso: txt(input.disponibilidad_aviso) || null,
    p_cv_url: cvUrl,
    p_portfolio_url: txt(input.portfolio_url) || null,
    p_linkedin_url: txt(input.linkedin_url) || null,
    p_motivacion: txt(input.motivacion) || null,
  });
  if (error) {
    // No dejar el CV huérfano si el registro no se guardó.
    if (uploadedPath) await admin.storage.from(CV_BUCKET).remove([uploadedPath]);
    // El motivo REAL queda en los logs de Vercel. Sin esto, el bug del teléfono
    // obligatorio (0046) estuvo días volteando altas y el mensaje genérico no
    // le daba una pista a nadie.
    console.error("[sumate] register RPC failed:", error.message);
    return { ok: false, reason: "No se pudo enviar el registro. Probá de nuevo." };
  }

  // Bienvenida en el momento (decisión de Franco, 29/7): el que se registra hoy
  // recibe el welcome CORTO al toque (el largo de la tanda es para las fichas
  // viejas). Se AWAITEA (fire-and-forget en serverless = el mail no sale nunca,
  // el mismo bug que tuvo muda a ENTRÁ), pero un fallo del mail NUNCA voltea el
  // registro: la ficha ya está guardada, y si el welcome no salió la ficha queda
  // con bienvenida_enviada_at en NULL y la tanda del cron la agarra después como
  // red de seguridad. Solo estampamos la marca cuando el envío salió ok.
  const profileId =
    data && typeof data === "object" && "id" in data ? String(data.id) : null;
  try {
    const firstName = nombre.split(/\s+/)[0] ?? "";

    // El link para ELEGIR la contraseña, generado acá y metido adentro de
    // nuestro mail (ver linkParaElegirContrasena). Si falla, el mail sale con el
    // link de siempre a /acceso-staff y la persona entra por el camino largo:
    // peor experiencia, pero nunca una puerta cerrada.
    const claveLink = await linkParaElegirContrasena(admin, email.toLowerCase(), "sumate");

    const html = await render(
      createElement(WelcomeEmail, {
        firstName,
        link: claveLink ?? siteUrl("/acceso-staff"),
        conLinkDeClave: claveLink !== null,
        bajaLink:
          profileId && bajaReady() ? bajaUrl(profileId) : undefined,
      }),
    );
    const result = await sendMail({
      to: email.toLowerCase(),
      subject: "Bienvenido/a a LABURO · SOMOS DER",
      html,
      headers: profileId ? bajaHeaders(profileId) : undefined,
    });
    if (result.ok && profileId) {
      const { error: markErr } = await admin.rpc("staff_app_mark_bienvenida", {
        p_profile_id: profileId,
      });
      if (markErr) {
        // La marca falló pero el mail salió: como mucho, la tanda le manda el
        // largo más adelante. Lo dejamos en los logs para verlo venir.
        console.error("[sumate] mark_bienvenida failed:", markErr.message);
      }
    } else if (!result.ok) {
      console.error("[sumate] welcome no salió:", result.error ?? result.channel);
    }
  } catch (e) {
    console.error(
      "[sumate] welcome render/send failed:",
      e instanceof Error ? e.message : String(e),
    );
  }

  // La marca de perfil confirmado se estampa SOLO cuando la persona mandó el
  // formulario largo, que es donde vio (y pudo llenar) todos los campos. El que
  // entra por la vía corta del CV queda con perfil_confirmado_at en NULL a
  // propósito: su ficha está a medias, y ese NULL es justo lo que hace que el
  // recordatorio de la migración 0034 la agarre a los 5 días y la invite a
  // completarla. Si estampáramos la marca ahí, esas fichas quedarían a medias
  // para siempre y nadie las iría a buscar nunca.
  //
  // El gate es por `modo`, nada más: modo ausente o desconocido cae en "rápido",
  // porque equivocarse mandando un recordatorio de más es barato y equivocarse
  // abandonando una ficha es para siempre.
  //
  // TOLERANTE: hasta que la 0034 se aplique la RPC no existe y esto solo loguea;
  // el registro ya está guardado y un fallo acá jamás lo voltea.
  const modo = input.modo === "completo" ? "completo" : "rapido";
  const perfilCompleto = modo === "completo";
  if (profileId && perfilCompleto) {
    try {
      const { error: confErr } = await admin.rpc("staff_app_mark_perfil_confirmado", {
        p_profile_id: profileId,
      });
      if (confErr) {
        console.error(
          "[sumate] mark_perfil_confirmado failed (¿falta aplicar la 0034?):",
          confErr.message,
        );
      }
    } catch (e) {
      console.error(
        "[sumate] mark_perfil_confirmado threw:",
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  return { ok: true };
}
