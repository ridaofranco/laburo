import "server-only";
import { orgActual } from "@/lib/org";

/**
 * QUIÉN PUEDE VER EL CONTACTO DE ALGUIEN DEL POOL.
 *
 * ── EL PROBLEMA QUE RESUELVE (pedido de Franco) ──
 * El modelo de LABURO es de intermediación: la ficha se ve, el contacto no, y a la
 * persona se llega a través de SOMOS DER. Eso es lo que sostiene la comisión.
 *
 * Pero hasta hoy eso estaba garantizado **por el acceso, no por el producto**: la
 * pantalla del perfil muestra Email, Teléfono y DNI a cualquiera que sea miembro de
 * la organización, y el visor del CV original tiene el contacto adentro del PDF. Con
 * un solo equipo eso no era un problema. El día que Franco le da acceso a un cliente
 * o abre el marketplace a otra productora, **el contacto queda a la vista y la
 * comisión se puede saltear**. Y ese día **está más cerca**: desde la 0071 existe
 * `manager`, que es justamente el rol para alguien que opera la productora sin ser
 * su dueño, y `viewer` para quien solo mira.
 *
 * ── CÓMO SE RESUELVE, SIN INVENTAR ESTRUCTURA ──
 * La app ya tiene roles por miembro (`staff_app.members.role`, default `writer`).
 * Así que el contacto se muestra SOLO a los roles de la casa, y cualquier rol nuevo
 * (un cliente, otra productora) NO lo ve por default. Es lo importante: **el
 * default es no mostrarlo.** Si mañana se agrega un rol `cliente`, no hay que
 * acordarse de nada.
 *
 * `MOSTRAR_CONTACTO_A` se puede ampliar por env var si hace falta sumar un rol
 * interno sin tocar código.
 */

/**
 * Los roles que SÍ ven el contacto. Todo lo demás, no.
 *
 * ⚠️ El default decía `owner,admin,writer` y **`admin` nunca existió**: el CHECK
 * de la base es `role = ANY (ARRAY['owner','writer','viewer'])` (0006:23,
 * verificado contra producción). Era una entrada muerta desde siempre: parecía
 * que había un rol contemplado y no había ninguno. Queda alineado con los roles
 * reales.
 *
 * ⚠️ **`viewer` NO entra, y es deliberado.** Un rol de sólo lectura no tiene por
 * qué ver mail, teléfono y DNI de terceros: eso es exactamente lo que sostiene
 * la intermediación. El default tiene que ser ocultar.
 *
 * ⚠️ **`manager` SÍ entra (0071).** Es un rol operativo de la casa: quien arma los
 * eventos y manda las ofertas necesita poder llamar a la gente. Si no viera el
 * contacto no podría trabajar, y alguien terminaría pasándoselo por WhatsApp, que
 * es peor que mostrarlo en la pantalla.
 *
 * ── ⚠️⚠️ SUPLANTANDO NO SE VE EL CONTACTO (5/9) ────────────────────────────
 * Cuando la plataforma entra a operar una productora ajena (0073), `orgActual()`
 * devuelve `rol: "writer"` para que las pantallas no se rompan. Sin este corte,
 * ese `writer` prestado **veía mail, teléfono, DNI y el PDF original del CV de
 * las fichas de esa productora**, que son datos personales de terceros que nunca
 * dieron su consentimiento a que los mire la plataforma.
 *
 * Peor: `impersonation_log` registra **que** entraste, no **qué miraste**. O sea
 * que se podían leer doscientas fichas con DNI y el rastro diría una sola línea.
 *
 * **Entrar a resolverle un problema a alguien no requiere ver el documento de su
 * gente.** Y este archivo ya dice cuál es el default ante la duda: ocultar. Si
 * algún día hace falta de verdad, se saca este corte y se documenta por qué —
 * pero que sea una decisión tomada, no un permiso heredado sin querer.
 *
 * ⚠️⚠️ **ESTE CORTE SOLO NO ALCANZABA, Y ES LA PARTE QUE IMPORTA.** Lo de acá
 * abajo es de aplicación: esconde las columnas en la pantalla. Pero quien
 * suplanta **es `member` a nivel Postgres** para esa organización, así que la
 * RLS lo dejaba leer y **la API devolvía el contacto igual** — bastaba pedir
 * `select=email,telefono,documento` contra PostgREST con ese mismo JWT.
 *
 * Lo encontró una revisión externa y está reproducido contra producción. El
 * corte de verdad lo hace la migración **0074**, que enmascara esas columnas en
 * las tres vistas mientras haya una suplantación viva. Esto de acá queda como
 * segunda barrera y para que la UI no muestre huecos raros.
 *
 * **La lección, para la próxima:** un corte de privacidad que vive en el
 * componente no es un corte, es una cortina. Si el dato no tiene que salir,
 * tiene que no salir de la base.
 */
const ROLES_INTERNOS = new Set(
  (process.env.MOSTRAR_CONTACTO_A || "owner,manager,writer")
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean),
);

export interface Permisos {
  /** El rol del que está mirando, tal como está en la base. */
  rol: string | null;
  /** true = puede ver mail, teléfono, DNI y el PDF original del CV. */
  verContacto: boolean;
}

/**
 * Lee el rol del usuario logueado y decide.
 *
 * FAIL-CLOSED: si no se puede averiguar el rol, **no se muestra el contacto**. En
 * una duda sobre datos personales de terceros, el default tiene que ser ocultar.
 */
export async function permisos(): Promise<Permisos> {
  try {
    // orgActual() ya es fail-closed y aguanta que el usuario sea miembro de más
    // de una organización (antes esto era un .maybeSingle() que reventaba con
    // PGRST116 en cuanto había dos membresías).
    const org = await orgActual();
    const rol = org?.rol ?? null;
    // Suplantando, el rol es prestado: no se ve el contacto. Ver el header.
    if (org?.suplantada) return { rol, verContacto: false };
    return { rol, verContacto: !!rol && ROLES_INTERNOS.has(rol) };
  } catch {
    return { rol: null, verContacto: false };
  }
}
