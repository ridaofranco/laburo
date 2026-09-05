"use server";

/**
 * EL LADO SERVIDOR DE LA PUERTA: mandar el link de acceso, y el chequeo de
 * proveedor que decide si ese pedido puede crear la cuenta.
 *
 * ── POR QUÉ EL ENVÍO SE MUDÓ ACÁ (2/9) ──────────────────────────────────────
 * Hasta hoy el link lo pedía el navegador, llamando a `signInWithOtp` directo.
 * Ese camino manda el mail de Supabase, que trae un `code` de PKCE: solo se
 * puede canjear en el MISMO navegador que lo pidió. El caso real es la persona
 * que pide el link desde el celular y lo abre en el visor interno de Gmail, que
 * es otro navegador: ve "ese link ya se usó o venció" con un link válido.
 *
 * El link con `token_hash` lo tiene que armar `admin.generateLink`, que
 * necesita la service-role key. Eso NO puede vivir en el navegador, así que el
 * envío entero se muda al servidor. Ver lib/auth-link.ts para el razonamiento
 * completo, incluido por qué no se toca la plantilla de Supabase.
 *
 * ── LO QUE NO CAMBIÓ ────────────────────────────────────────────────────────
 * · La respuesta sigue siendo SIEMPRE la misma (decisión de Franco, 28/7):
 *   mostrar si la cuenta existe sería un oráculo de qué mails están
 *   registrados. Por eso devuelve `{ ok: true }` pase lo que pase.
 * · Si el link propio no se puede armar o el mail no sale, se cae al
 *   `signInWithOtp` de siempre. El peor caso es "quedó como estaba".
 * · Entrar con mail y contraseña no pasa por acá y quedó intacto.
 *
 * ── Y LO QUE HUBO QUE SUMAR ─────────────────────────────────────────────────
 * ⚠️ FRENO DE ABUSO. Mientras el envío lo hacía Supabase, el tope de mails del
 * proyecto era el techo. Ahora el mail sale por NUESTRO mailer, así que sin un
 * freno acá esta pantalla sería una máquina de mandarle mails a cualquier
 * casilla ajena. Es el mismo criterio y los mismos números que /acceso-staff.
 *
 * ── ⚠️ PARA PROBAR ESTO EN LOCAL ────────────────────────────────────────────
 * El link se arma con `SITE_URL`, no con el origin del navegador, y eso es a
 * propósito: el origin lo manda el cliente y confiarle a quien pide el link el
 * dominio al que va a apuntar es regalarle un link de acceso apuntando a su
 * propio servidor. En producción `SITE_URL` está cargada y no hay nada que
 * hacer. En local, si no está en `.env.local`, cae al default
 * (laburo.somosder.ar) y el link del mail apunta a producción: hay que cargar
 * `SITE_URL=http://localhost:3000` para probarlo. Sin mailer configurado
 * (RESEND o SMTP) además no sale ningún mail y siempre corre la válvula.
 */

/**
 * Lo único más que la puerta necesita del servidor: si un mail corresponde a un
 * proveedor que ya existe.
 *
 * ── POR QUÉ HACE FALTA ──────────────────────────────────────────────────────
 * Los proveedores que se anotaron antes del 5/8 NO tienen usuario en `auth`:
 * el diseño original era sin cuenta, solo link mágico. Si la puerta les manda un
 * magic link con `shouldCreateUser: false` (que es lo correcto para productoras
 * y staff), Supabase no crea nada, no manda nada, y la persona se queda mirando
 * un "te mandamos un mail" que nunca llega. Es exactamente el callejón sin
 * salida que Franco vino a arreglar.
 *
 * Entonces: si el mail ES de un proveedor cargado, se permite crear el usuario
 * de auth en ese primer ingreso. El vínculo cuenta ↔ perfil lo hace después
 * `staff_app_vincular_proveedor` en /auth/callback.
 *
 * ── POR QUÉ PASA POR ACÁ Y NO POR EL BROWSER ────────────────────────────────
 * `staff_app_email_es_proveedor` está granteada SOLO a service_role, y su propio
 * comentario explica por qué: si fuera alcanzable desde el navegador sería un
 * oráculo de "este mail es proveedor" y se podría enumerar el directorio con una
 * lista de mails. Acá se la llama con la clave de servicio y **no se le devuelve
 * la respuesta cruda a la pantalla**: la pantalla siempre muestra el mismo
 * mensaje, exista o no la cuenta.
 */

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { mandarLinkDeAcceso, type RolHint } from "@/lib/auth-link";
import { siteUrl } from "@/lib/site";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Devuelve si conviene permitir que el magic link cree el usuario de auth.
 * Nunca tira: ante la duda devuelve false, que es el comportamiento de siempre.
 *
 * Ya no se exporta (2/9): la llamaba el navegador, y desde que el envío del link
 * vive del lado del servidor no hace falta que sea un endpoint alcanzable. Un
 * server action menos expuesto es un oráculo menos que cuidar.
 */
async function proveedorPuedeCrearCuenta(email: string): Promise<boolean> {
  const clean = (email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(clean)) return false;

  // Freno: sin esto esto sí sería un oráculo, uno por request.
  const ip = await clientIp();
  if (!rateLimit(`prv-existe:ip:${ip}`, 12, 60_000).ok) return false;

  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin.rpc("staff_app_email_es_proveedor", {
      p_email: clean,
    });
    if (error) {
      console.error("[entrar] no se pudo chequear si es proveedor:", error.message);
      return false;
    }
    return data === true;
  } catch (e) {
    console.error("[entrar] chequeo de proveedor falló:", e instanceof Error ? e.message : String(e));
    return false;
  }
}

/**
 * ⭐ MANDAR EL LINK DE ACCESO. Lo usan las DOS puertas: /entrar y /login.
 *
 * ── POR QUÉ UNA SOLA FUNCIÓN PARA LAS DOS ───────────────────────────────────
 * Porque este repo ya pagó dos veces el precio de copiar en vez de compartir: el
 * botón de Google se arregló del lado del staff y quedó roto del lado del
 * productor, y `signInWithPassword` vivió únicamente en el staff mientras el
 * mail de bienvenida de la productora le prometía una clave que no podía usar en
 * ningún lado. Franco lo dijo textual: "lo que hacés para empleados no lo hacés
 * para productores". Un freno de abuso, una válvula y un fallback, no dos.
 *
 * ── LO QUE CAMBIA ENTRE UNA PUERTA Y LA OTRA ────────────────────────────────
 * Solamente el `rol`:
 *   · /entrar manda el que la persona eligió, y ese hint viaja hasta
 *     /auth/callback para desempatar a quien tiene más de un perfil.
 *   · /login manda `null`, igual que hoy: su `emailRedirectTo` nunca llevó
 *     `como` y el ruteo por orden natural es el que corresponde ahí.
 *
 * Y de ese rol sale la única decisión que importa: si este pedido puede CREAR la
 * cuenta de auth. Solo el proveedor y el salón cuya ficha ya existe pueden,
 * porque nacieron sin cuenta (el diseño original era por token) y si no nunca
 * entrarían. Para todos los demás es false, como siempre.
 *
 * Devuelve SIEMPRE `{ ok: true }`. La pantalla muestra el mismo mensaje exista o
 * no la cuenta.
 */
export async function pedirLinkDeAcceso(
  email: string,
  rol: RolHint | null,
): Promise<{ ok: true }> {
  const clean = (email || "").trim().toLowerCase();
  if (!clean || !EMAIL_RE.test(clean)) return { ok: true };

  // ⚠️ FRENO DE ABUSO, mismos números que /acceso-staff. Antes el techo lo ponía
  // Supabase, que era quien mandaba el mail; ahora sale por nuestro mailer y el
  // techo tiene que estar acá. 5 por minuto por IP (una persona real necesita
  // uno, dos si se equivocó), 20 por hora por IP para la oficina con varias
  // personas, y 3 cada diez minutos por dirección para que nadie use esta
  // pantalla para bombardear una casilla ajena.
  const ip = await clientIp();
  if (!rateLimit(`entrar-link:ip:${ip}`, 5, 60_000).ok) return { ok: true };
  if (!rateLimit(`entrar-link:ip-hora:${ip}`, 20, 3_600_000).ok) return { ok: true };
  if (!rateLimit(`entrar-link:mail:${clean}`, 3, 600_000).ok) return { ok: true };

  const crearSiHaceFalta =
    rol === "proveedor" || rol === "salon"
      ? await proveedorPuedeCrearCuenta(clean)
      : false;

  const etiqueta = rol ? `entrar-${rol}` : "login";

  // 1. El camino bueno: nuestro mail, con un link que se puede abrir en
  //    cualquier navegador.
  const admin = createServiceRoleClient();
  const mandado = await mandarLinkDeAcceso(admin, clean, {
    como: rol,
    crearSiNoExiste: crearSiHaceFalta,
    etiqueta,
  });
  if (mandado) return { ok: true };

  // 2. LA VÁLVULA. Si el link propio no se pudo armar (el caso más común y
  //    esperado: el mail no tiene cuenta y este pedido no puede crearla) o el
  //    mail no salió, se cae EXACTAMENTE al comportamiento de antes. El peor
  //    caso de todo este cambio tiene que ser "quedó como estaba", nunca "no
  //    entra nadie".
  try {
    const supabase = await createClient();
    await supabase.auth.signInWithOtp({
      email: clean,
      options: {
        emailRedirectTo: siteUrl(`/auth/callback${rol ? `?como=${rol}` : ""}`),
        shouldCreateUser: crearSiHaceFalta,
      },
    });
  } catch (e) {
    console.error(
      `[${etiqueta}] el fallback a signInWithOtp también falló:`,
      e instanceof Error ? e.message : String(e),
    );
  }
  return { ok: true };
}
