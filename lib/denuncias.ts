import "server-only";
import { alerta } from "@/lib/alerta";

/**
 * DENUNCIAS DE OFERTAS (Franco 31/10, plan del cambio de LABURO, fase 1 punto 5).
 *
 * Cada denuncia sale en el momento por lib/alerta: Telegram a Franco + el mail
 * espejo a MAIL_ADMIN_TO, que queda como registro con fecha. Sin anti-repetición
 * (cada denuncia es un dato: la clave lleva la hora).
 *
 * ⚠️ Todavía NO hay tabla propia: crear `staff_app.denuncias` es una migración en
 * producción y de noche la frena el permiso. Queda como pendiente; mientras
 * tanto el registro es el mail. La baja de una oferta manifiestamente ilícita
 * (pide plata, discrimina, involucra menores) la hace Franco al recibir el aviso;
 * el resto se revisa en 48 a 72 h (términos, cláusula 7).
 */

export const MOTIVOS_DENUNCIA = {
  pide_plata: "Me piden plata para trabajar o postularme",
  discrimina: "Discrimina (edad, sexo, apariencia, nacionalidad u otro)",
  falsa: "Parece falsa o engañosa",
  ilegal: "Trabajo ilegal, en negro o con menores",
  otro: "Otro motivo",
} as const;

export type MotivoDenuncia = keyof typeof MOTIVOS_DENUNCIA;

export function motivoValido(m: unknown): m is MotivoDenuncia {
  return typeof m === "string" && Object.prototype.hasOwnProperty.call(MOTIVOS_DENUNCIA, m);
}

/** Avisa la denuncia. Nunca tira; devuelve si salió por algún canal. */
export async function avisarDenuncia(d: {
  motivo: MotivoDenuncia;
  detalle?: string | null;
  donde: string;
  rol?: string | null;
  evento?: string | null;
  quienPublica?: string | null;
  referencia?: string | null;
  denunciante?: string | null;
}): Promise<boolean> {
  const urgente = d.motivo === "pide_plata" || d.motivo === "ilegal" || d.motivo === "discrimina";
  return alerta({
    titulo: `${urgente ? "⚠️ DENUNCIA URGENTE (revisar y dar de baja si corresponde)" : "Denuncia de oferta (revisar en 48 a 72 h)"}`,
    clave: `denuncia-${Date.now()}-${Math.random()}`,
    datos: {
      Motivo: MOTIVOS_DENUNCIA[d.motivo],
      Dónde: d.donde,
      Rol: d.rol,
      Evento: d.evento,
      "Quien publica": d.quienPublica,
      Referencia: d.referencia,
      Denunciante: d.denunciante,
      Fecha: new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hourCycle: "h23" }),
    },
    detalle: d.detalle?.trim() ? d.detalle.trim().slice(0, 500) : undefined,
  });
}
