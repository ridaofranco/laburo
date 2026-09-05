"use server";

/**
 * ALTA ABIERTA DE PROVEEDOR.
 *
 * Decisión de Franco (3/8): "No voy a cargar proveedores, tiene que estar listo
 * para que proveedores se carguen solos".
 *
 * ── POR QUÉ TODO PASA POR ACÁ Y NO POR EL BROWSER ────────────────────────────
 * `staff_app_registrar_proveedor` está granteada SOLO a service_role. Si fuera
 * llamable desde el cliente, cualquiera llenaría la vidriera de perfiles
 * públicos en un loop. El freno de abuso vive acá, igual que en /sumate y
 * /registrar-productora.
 *
 * ── EL AVISO A FRANCO NO ES OPCIONAL ─────────────────────────────────────────
 * El proveedor aparece en la vidriera AL TOQUE, sin que nadie apruebe nada
 * (decisión 1 de Franco). El único control es que Franco se entere en el momento
 * y pueda bajarlo. Ya pasó una vez: el único proveedor de prueba tenía una
 * obscenidad en la bio y era el 100% del directorio, visible para cualquier
 * productora. Por eso el aviso lleva el link directo para despublicarlo.
 *
 * ── EL PROVEEDOR NO TIENE CUENTA ─────────────────────────────────────────────
 * Entra por link mágico con token, no por /login. El mail dice exactamente eso:
 * es el error que costó una trabajadora el 1/8 del lado del staff.
 *
 * ── POR QUÉ REINSCRIBIRSE NO PISA LOS DATOS (y por qué se devuelve `yaExistia`)
 * Si el mail ya tiene perfil, `staff_app_registrar_proveedor` sólo regenera el
 * token y devuelve `ya_existia = true`: los servicios y todo lo que la persona
 * acaba de escribir se descarta. Eso NO es un descuido, y no se cambia:
 *
 * 1. SEGURIDAD, y es la que decide. Este formulario es PÚBLICO y sin sesión:
 *    cualquiera que sepa el mail de un proveedor lo puede completar. Hoy lo peor
 *    que logra es invalidar el token viejo y que salga un mail nuevo A LA
 *    CASILLA DEL DUEÑO, o sea que el atacante no recibe nada. Si el formulario
 *    pudiera pisar los datos, un desconocido reescribiría la ficha pública
 *    (nombre, bio, zona, web, instagram) y sus servicios sin probar jamás que
 *    ese mail es suyo. Eso es una toma de perfil: sería una regresión de
 *    seguridad para arreglar un problema de copy.
 * 2. Ya está decidido y documentado (0060, líneas 115 a 118): no se pisan los
 *    datos porque destruir el trabajo de alguien por un click sería peor. Acá es
 *    más evidente todavía, porque el alta trae servicios (una tabla hija entera).
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

export interface RegistrarProveedorResult {
  ok: boolean;
  error?: string;
  /**
   * true si el mail ya tenía perfil de proveedor: la RPC regeneró el token y NO
   * guardó nada de lo que se acaba de escribir. Sólo viene con `ok: true`; la
   * pantalla lo usa para decir la verdad en vez de un "listo" que miente.
   */
  yaExistia?: boolean;
}

export interface ServicioInput {
  categoria: string;
  titulo: string;
  descripcion?: string;
  precio_desde?: string;
  unidad?: string;
  provincias: string[];
}

export interface RegistrarProveedorInput {
  nombre: string;
  email: string;
  telefono?: string;
  headline?: string;
  bio?: string;
  ciudad?: string;
  provincia?: string;
  website?: string;
  instagram?: string;
  servicios: ServicioInput[];
}

export async function registrarProveedor(
  input: RegistrarProveedorInput,
): Promise<RegistrarProveedorResult> {
  const nombre = (input.nombre || "").trim();
  const email = (input.email || "").trim().toLowerCase();

  if (!nombre) return { ok: false, error: "Escribí el nombre de tu empresa o el tuyo." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Ese email no parece válido." };

  const servicios = (input.servicios || []).filter(
    (s) => (s.categoria || "").trim() && (s.titulo || "").trim(),
  );
  if (servicios.length === 0) {
    return { ok: false, error: "Cargá al menos un servicio, con su rubro y qué ofrecés." };
  }
  if (!servicios.some((s) => (s.provincias || []).some((p) => (p || "").trim()))) {
    return {
      ok: false,
      error: "Marcá en qué provincias trabajás. Sin eso no aparecés en las búsquedas.",
    };
  }

  // Freno de abuso: cada alta publica un perfil en la vidriera Y manda un mail.
  const ip = await clientIp();
  if (!rateLimit(`prv:ip:${ip}`, 3, 60_000).ok) {
    return { ok: false, error: "Esperá un minuto y volvé a intentar." };
  }
  if (!rateLimit(`prv:ip-hora:${ip}`, 10, 3_600_000).ok) {
    return { ok: false, error: "Demasiados registros desde esta conexión. Probá más tarde." };
  }
  if (!rateLimit(`prv:mail:${email}`, 3, 600_000).ok) {
    return { ok: false, error: "Ya recibimos tu registro. Revisá tu casilla, incluido el spam." };
  }

  const admin = createServiceRoleClient();
  const { data, error } = await admin.rpc("staff_app_registrar_proveedor", {
    p_nombre: nombre,
    p_email: email,
    p_servicios: servicios.map((s) => ({
      categoria: (s.categoria || "").trim(),
      titulo: (s.titulo || "").trim(),
      descripcion: (s.descripcion || "").trim() || null,
      precio_desde: (s.precio_desde || "").trim() || null,
      unidad: (s.unidad || "").trim() || null,
      provincias: (s.provincias || []).filter((p) => (p || "").trim()),
    })),
    p_telefono: (input.telefono || "").trim() || null,
    p_headline: (input.headline || "").trim() || null,
    p_bio: (input.bio || "").trim() || null,
    p_ciudad: (input.ciudad || "").trim() || null,
    p_provincia: (input.provincia || "").trim() || null,
    p_website: (input.website || "").trim() || null,
    p_instagram: (input.instagram || "").trim() || null,
    p_dias: DIAS_DEL_LINK,
  });

  if (error) {
    console.error("[registrar-proveedor] RPC falló:", error.message);
    return { ok: false, error: "No se pudo crear el perfil. Probá de nuevo." };
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
    if (r?.reason === "falta_nombre") return { ok: false, error: "Escribí el nombre." };
    if (r?.reason === "falta_email") return { ok: false, error: "Ese email no parece válido." };
    if (r?.reason === "falta_servicios") {
      return { ok: false, error: "Cargá al menos un servicio, con su rubro y qué ofrecés." };
    }
    if (r?.reason === "falta_provincias") {
      return {
        ok: false,
        error: "Marcá en qué provincias trabajás. Sin eso no aparecés en las búsquedas.",
      };
    }
    return { ok: false, error: "No se pudo crear el perfil. Probá de nuevo." };
  }

  const linkPanel = siteUrl(`/acceso-proveedor/${r.token}`);

  // El mail sale SIEMPRE, también si ya existía: el caso normal de volver a
  // anotarse es "no me llegó". Un fallo del envío nunca voltea el alta, que ya
  // está guardada. Pero sí se avisa, porque un proveedor publicado que nunca
  // recibió su link es un perfil que nadie puede editar ni bajar.
  let mailOk = false;
  try {
    const html = await render(
      createElement(BienvenidaProveedor, {
        nombre,
        link: linkPanel,
        dias: DIAS_DEL_LINK,
        yaExistia: !!r.ya_existia,
      }),
    );
    const res = await sendMail({
      to: email,
      subject: r.ya_existia
        ? `Tu link nuevo para entrar a LABURO`
        : `${nombre} ya está publicado en LABURO`,
      html,
    });
    mailOk = !!res.ok;
    if (!res.ok) {
      console.error("[registrar-proveedor] mail no salió:", res.error ?? res.channel);
    }
  } catch (e) {
    console.error(
      "[registrar-proveedor] render/send falló:",
      e instanceof Error ? e.message : String(e),
    );
  }

  // El aviso a Franco: es EL control de la alta abierta, no un extra. Lleva el
  // link publico (para ver que publicó) y el de moderación (para bajarlo).
  await alerta({
    titulo: r.ya_existia
      ? `Un proveedor pidió su link de nuevo: ${nombre}`
      : `Proveedor nuevo publicado: ${nombre}`,
    // Cada alta es un aviso propio: si se agrupan por título, dos altas seguidas
    // de proveedores distintos se comerían la segunda por el anti-repetición.
    clave: `proveedor-alta:${r.profile_id}`,
    sinMail: false,
    datos: {
      nombre,
      email,
      servicios: servicios.length,
      "ficha pública": r.slug ? siteUrl(`/servicios/${r.slug}`) : "(sin slug)",
      moderar: siteUrl("/plataforma/proveedores"),
      "le llegó el mail": mailOk ? "sí" : "NO, revisar",
      "ya existía": r.ya_existia ? "sí" : "no",
    },
  });

  // ⚠️ `yaExistia` viaja hasta la pantalla a propósito: si la RPC no guardó los
  // datos nuevos, decir "listo, ya está publicado" es mentir.
  return { ok: true, yaExistia: !!r.ya_existia };
}
