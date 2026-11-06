/**
 * CUIT o DNI de quien publica (plan fase 2, punto 6). Solo lo ve la plataforma:
 * se guarda en staff_app.organizacion_identidad (0107), que no tiene políticas.
 */

export type DocTipo = "CUIT" | "DNI";

/** Dígito verificador del CUIT/CUIL (módulo 11, pesos 5-4-3-2-7-6-5-4-3-2). */
export function cuitValido(cuit: string): boolean {
  const d = cuit.replace(/\D/g, "");
  if (d.length !== 11) return false;
  if (!["20", "23", "24", "27", "30", "33", "34"].includes(d.slice(0, 2))) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((s, p, i) => s + p * Number(d[i]), 0);
  const resto = 11 - (suma % 11);
  const dv = resto === 11 ? 0 : resto === 10 ? 9 : resto;
  return dv === Number(d[10]);
}

/** Valida y normaliza. Devuelve el número solo con dígitos o un error legible. */
export function validarDocumento(
  tipo: string,
  numero: string,
): { ok: true; tipo: DocTipo; numero: string } | { ok: false; error: string } {
  const n = (numero || "").replace(/\D/g, "");
  if (tipo === "CUIT") {
    if (n.length !== 11) return { ok: false, error: "El CUIT tiene 11 números (ej.: 30-12345678-9)." };
    if (!cuitValido(n)) return { ok: false, error: "Ese CUIT no es válido: revisá los números." };
    return { ok: true, tipo: "CUIT", numero: n };
  }
  if (tipo === "DNI") {
    if (n.length < 7 || n.length > 8) return { ok: false, error: "El DNI tiene 7 u 8 números." };
    return { ok: true, tipo: "DNI", numero: n };
  }
  return { ok: false, error: "Elegí si cargás CUIT o DNI." };
}
