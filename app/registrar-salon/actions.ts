"use server";

/**
 * ALTA ABIERTA DE SALÓN (cuarto pool, 6/8).
 *
 * Misma decisión de fondo que la del proveedor (Franco, 3/8): *"tiene que estar
 * listo para que se carguen solos"*. Nadie carga salones a mano.
 *
 * ── POR QUÉ TODO PASA POR ACÁ Y NO POR EL BROWSER ───────────────────────────
 * `staff_app_registrar_salon` está granteada SOLO a service_role. Si fuera
 * llamable desde el cliente, cualquiera llenaría la vidriera de salones falsos
 * en un loop. El freno de abuso vive acá, igual que en /registrar-proveedor.
 *
 * ── EL AVISO A FRANCO NO ES OPCIONAL ────────────────────────────────────────
 * El salón aparece en la vidriera AL TOQUE, sin que nadie apruebe nada. El único
 * control es que Franco se entere en el momento y pueda bajarlo. Ya pasó una vez
 * del lado de proveedores: el único de prueba tenía una obscenidad en la bio y
 * era el 100% del directorio. Por eso el aviso lleva el link para despublicarlo.
 *
 * ── EL SALÓN NO TIENE CUENTA ────────────────────────────────────────────────
 * Entra por link mágico con token, no por /login. El mail dice exactamente eso:
 * es el error que costó una trabajadora el 1/8 del lado del staff.
 *
 * ── POR QUÉ REINSCRIBIRSE NO PISA LOS DATOS (y por qué se devuelve `yaExistia`)
 * Si el mail ya tiene ficha, `staff_app_registrar_salon` sólo regenera el token
 * y devuelve `ya_existia = true`: la capacidad, la dirección y todo lo que la
 * persona acaba de escribir se descarta. Eso NO es un descuido, y no se cambia:
 *
 * 1. SEGURIDAD, y es la que decide. Este formulario es PÚBLICO y sin sesión:
 *    cualquiera que sepa el mail de un salón lo puede completar. Hoy lo peor que
 *    logra es invalidar el token viejo y que salga un mail nuevo A LA CASILLA
 *    DEL DUEÑO, o sea que el atacante no recibe nada. Si el formulario pudiera
 *    pisar los datos, un desconocido reescribiría la ficha pública de un salón
 *    (nombre, dirección, capacidad, web, instagram, bio) sin probar jamás que
 *    ese mail es suyo. Eso es una toma de perfil: sería una regresión de
 *    seguridad para arreglar un problema de copy.
 * 2. Ya está decidido y documentado (0060, líneas 115 a 118): no se pisan los
 *    datos porque destruir el trabajo de alguien por un click sería peor.
 * 3. El lugar para editar ya existe y es autenticado: el link nuevo lleva al
 *    panel, donde la propiedad del mail ya está probada.
 *
 * Lo que estaba mal era la PANTALLA, que decía "listo, ya está publicado" como
 * si hubiera guardado algo. Por eso este action devuelve `yaExistia` en vez de
 * tirarlo: es el mismo criterio de "estado honesto" que ya se usa con `mailOk`.
 */

import { createElement } from "react";
import { render } from "@react-email/components";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendMail } from "@/lib/email/mailer";
import { BienvenidaProveedor } from "@/components/emails/bienvenida-proveedor";
import { siteUrl } from "@/lib/site";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { alerta } from "@/lib/alerta";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Cuántos días vive el link mágico. Se dice en el mail, así que va acá una vez. */
const DIAS_DEL_LINK = 30;

export interface RegistrarSalonResult {
  ok: boolean;
  error?: string;
  /**
   * true si el mail ya tenía ficha de salón: la RPC regeneró el token y NO
   * guardó nada de lo que se acaba de escribir. Sólo viene con `ok: true`; la
   * pantalla lo usa para decir la verdad en vez de un "listo" que miente.
   */
  yaExistia?: boolean;
}

export interface RegistrarSalonInput {
  nombre: string;
  email: string;
  provincia: string;
  capacidadMax: string;
  capacidadMin?: string;
  telefono?: string;
  headline?: string;
  bio?: string;
  ciudad?: string;
  direccion?: string;
  website?: string;
  instagram?: string;
  superficieM2?: string;
  amenities?: string[];
  tiposEvento?: string[];
  /** null cuando el salón no quiso contestar. NO es lo mismo que false. */
  cateringPropio?: boolean | null;
  estacionamiento?: boolean | null;
}

/**
 * Los números llegan como texto del formulario. Devuelve null para vacío y para
 * basura: un NaN viajando a la RPC es un error crudo de Postgres, no una
 * validación con mensaje.
 */
function aEntero(v: string | undefined): number | null {
  const n = Number.parseInt((v ?? "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function registrarSalon(
  input: RegistrarSalonInput,
): Promise<RegistrarSalonResult> {
  const nombre = (input.nombre || "").trim();
  const email = (input.email || "").trim().toLowerCase();
  const provincia = (input.provincia || "").trim();
  const capacidadMax = aEntero(input.capacidadMax);
  const capacidadMin = aEntero(input.capacidadMin);

  // Se valida acá ADEMÁS de en la RPC, y no en vez de. Acá para poder decirle a
  // la persona qué le falta en su idioma; adentro porque es el único chequeo que
  // no se puede saltear.
  if (!nombre) return { ok: false, error: "Escribí el nombre del salón." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Ese email no parece válido." };
  if (!provincia) {
    return {
      ok: false,
      error: "Elegí la provincia. Sin eso tu salón no aparece en ninguna búsqueda.",
    };
  }
  if (!capacidadMax) {
    return {
      ok: false,
      error: "Poné cuánta gente entra como máximo. Es con lo que te van a buscar.",
    };
  }
  if (capacidadMin != null && capacidadMin > capacidadMax) {
    return {
      ok: false,
      error: "El mínimo no puede ser más grande que el máximo. Revisá los dos números.",
    };
  }

  // Freno de abuso: cada alta publica un salón en la vidriera Y manda un mail.
  const ip = await clientIp();
  if (!rateLimit(`sln:ip:${ip}`, 3, 60_000).ok) {
    return { ok: false, error: "Esperá un minuto y volvé a intentar." };
  }
  if (!rateLimit(`sln:ip-hora:${ip}`, 10, 3_600_000).ok) {
    return { ok: false, error: "Demasiados registros desde esta conexión. Probá más tarde." };
  }
  if (!rateLimit(`sln:mail:${email}`, 3, 600_000).ok) {
    return { ok: false, error: "Ya recibimos tu registro. Revisá tu casilla, incluido el spam." };
  }

  const admin = createServiceRoleClient();
  const { data, error } = await admin.rpc("staff_app_registrar_salon", {
    p_nombre: nombre,
    p_email: email,
    p_provincia: provincia,
    p_capacidad_max: capacidadMax,
    p_telefono: (input.telefono || "").trim() || null,
    p_headline: (input.headline || "").trim() || null,
    p_bio: (input.bio || "").trim() || null,
    p_ciudad: (input.ciudad || "").trim() || null,
    p_direccion: (input.direccion || "").trim() || null,
    p_website: (input.website || "").trim() || null,
    p_instagram: (input.instagram || "").trim() || null,
    p_capacidad_min: capacidadMin,
    p_superficie_m2: aEntero(input.superficieM2),
    p_amenities: (input.amenities || []).filter((a) => (a || "").trim()),
    p_tipos_evento: (input.tiposEvento || []).filter((t) => (t || "").trim()),
    p_catering_propio: input.cateringPropio ?? null,
    p_estacionamiento: input.estacionamiento ?? null,
    p_dias: DIAS_DEL_LINK,
  });

  if (error) {
    console.error("[registrar-salon] RPC falló:", error.message);
    return { ok: false, error: "No se pudo crear el salón. Probá de nuevo." };
  }

  const r = data as {
    ok?: boolean;
    reason?: string;
    token?: string;
    slug?: string;
    profile_id?: string;
    ya_existia?: boolean;
  } | null;

  if (!r?.ok) {
    const MENSAJES: Record<string, string> = {
      falta_nombre: "Escribí el nombre del salón.",
      falta_email: "Ese email no parece válido.",
      falta_provincia: "Elegí la provincia. Sin eso no aparecés en ninguna búsqueda.",
      falta_capacidad: "Poné cuánta gente entra como máximo.",
      capacidad_invertida: "El mínimo no puede ser más grande que el máximo.",
    };
    return {
      ok: false,
      error: MENSAJES[r?.reason ?? ""] ?? "No se pudo crear el salón. Probá de nuevo.",
    };
  }

  const linkPanel = siteUrl(`/acceso-proveedor/${r.token}`);

  // El mail sale SIEMPRE, también si ya existía: el caso normal de volver a
  // anotarse es "no me llegó". Un fallo del envío nunca voltea el alta, que ya
  // está guardada. Pero sí se avisa, porque un salón publicado que nunca recibió
  // su link es un perfil que nadie puede editar ni bajar.
  let mailOk = false;
  try {
    const html = await render(
      createElement(BienvenidaProveedor, {
        nombre,
        link: linkPanel,
        dias: DIAS_DEL_LINK,
        yaExistia: !!r.ya_existia,
        esSalon: true,
      }),
    );
    const res = await sendMail({
      to: email,
      subject: r.ya_existia
        ? "Tu link nuevo para entrar a LABURO"
        : `${nombre} ya está publicado en LABURO`,
      html,
    });
    mailOk = !!res.ok;
    if (!res.ok) {
      console.error("[registrar-salon] mail no salió:", res.error ?? res.channel);
    }
  } catch (e) {
    console.error(
      "[registrar-salon] render/send falló:",
      e instanceof Error ? e.message : String(e),
    );
  }

  await alerta({
    titulo: r.ya_existia
      ? `Un salón pidió su link de nuevo: ${nombre}`
      : `Salón nuevo publicado: ${nombre}`,
    // Cada alta es un aviso propio: si se agrupan por título, dos altas seguidas
    // de salones distintos se comerían la segunda por el anti-repetición.
    clave: `salon-alta:${r.profile_id}`,
    sinMail: false,
    datos: {
      nombre,
      email,
      provincia,
      capacidad: capacidadMin ? `${capacidadMin} a ${capacidadMax}` : `hasta ${capacidadMax}`,
      "ficha pública": r.slug ? siteUrl(`/salones/${r.slug}`) : "(sin slug)",
      moderar: siteUrl("/plataforma/proveedores"),
      "le llegó el mail": mailOk ? "sí" : "NO, revisar",
      "ya existía": r.ya_existia ? "sí" : "no",
    },
  });

  // ⚠️ `yaExistia` viaja hasta la pantalla a propósito: si la RPC no guardó los
  // datos nuevos, decir "listo, ya está publicado" es mentir.
  return { ok: true, yaExistia: !!r.ya_existia };
}
