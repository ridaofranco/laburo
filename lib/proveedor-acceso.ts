/**
 * CÓMO ENTRA EL PROVEEDOR A SU PANEL: por link o por sesión.
 *
 * ── EL PROBLEMA QUE RESUELVE ────────────────────────────────────────────────
 * Hasta el 5/8 el proveedor entraba de UNA sola forma: con un link mágico que
 * le llegaba por mail y vencía a los 30 días. Si lo perdía, no entraba más.
 * Decisión de Franco (5/8): "TODOS TIENEN QUE PODER REGISTRARSE EN SU BASE" y
 * que ingresar sea fácil, o sea que el proveedor también tiene cuenta.
 *
 * Pero el link NO se retira: hay proveedores que ya lo tienen, y la landing
 * promete "no hace falta crear una cuenta". Entonces las dos puertas conviven.
 *
 * ── POR QUÉ ESTE ARCHIVO EXISTE ─────────────────────────────────────────────
 * La base ya tenía las DOS familias de funciones, escritas en su momento y
 * nunca conectadas a ninguna pantalla:
 *
 *   por token   → staff_app_proveedor_*      (0042, anon, el token es la identidad)
 *   por sesión  → staff_app_mi_proveedor_*   (authenticated, auth.uid() es la identidad)
 *
 * Hacen exactamente lo mismo y devuelven lo mismo. Lo único que cambia es de
 * dónde sale el "quién sos". Sin esta abstracción habría que duplicar las 5
 * acciones y los 4 componentes del panel, y esa copia es justo la que se
 * desincroniza: se arregla un lado, el otro queda viejo, y en tres meses nadie
 * sabe cuál es el bueno. Ya pasó con los proveedores de HITO.
 *
 * Regla: el panel del proveedor NUNCA sabe por dónde entró. Recibe un `Acceso`
 * y listo.
 */

/** Por dónde entró el proveedor. Es su identidad ante la base. */
export type Acceso =
  | { por: "token"; token: string }
  | { por: "sesion" };

/**
 * El nombre de la RPC y los parámetros de identidad, según la puerta.
 *
 * Las RPC por sesión NO reciben identidad como argumento: la sacan de
 * `auth.uid()` adentro. Por eso el objeto de parámetros va vacío y no con un
 * `p_token: null`, que la firma ni siquiera acepta.
 */
export function rpcDe(
  acceso: Acceso,
  accion: "perfil" | "guardar_perfil" | "guardar_servicio" | "borrar_servicio" | "publicar" | "formulario" | "guardar_formulario",
): { nombre: string; identidad: Record<string, string> } {
  if (acceso.por === "token") {
    return {
      nombre: `staff_app_proveedor_${accion}`,
      identidad: { p_token: acceso.token },
    };
  }
  return {
    // Las de sesión se llaman staff_app_mi_proveedor_*, salvo la de leer el
    // perfil, que quedó como staff_app_mi_perfil_proveedor. No se renombra
    // desde acá: renombrar una función en producción es una migración y un
    // deploy coordinado, y no gana nada.
    // Las de sesión son la familia staff_app_mi_proveedor_*, salvo la de leer
    // el perfil, que quedó como staff_app_mi_perfil_proveedor en la 0045. No se
    // renombra desde acá: renombrar una función en producción es una migración
    // más un deploy coordinado, y no gana nada.
    nombre:
      accion === "perfil"
        ? "staff_app_mi_perfil_proveedor"
        : `staff_app_mi_proveedor_${accion}`,
    identidad: {},
  };
}

/** Para los links del panel: a dónde vuelve el proveedor según su puerta. */
export function inicioDe(acceso: Acceso): string {
  return acceso.por === "token" ? `/acceso-proveedor/${acceso.token}` : "/mi-proveedor";
}
