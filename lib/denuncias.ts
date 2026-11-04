import "server-only";
import { alerta } from "@/lib/alerta";
import { createServiceRoleClient } from "@/lib/supabase/admin";

/**
 * DENUNCIAS DE OFERTAS (Franco 31/10, plan del cambio de LABURO, fase 1 punto 5).
 *
 * Cada denuncia sale en el momento por lib/alerta: Telegram a Franco + el mail
 * espejo a MAIL_ADMIN_TO, que queda como registro con fecha. Sin anti-repetición
 * (cada denuncia es un dato: la clave lleva la hora).
 *
 * Además (4/11) cada denuncia se guarda en `staff_app.denuncias` (migración 0105)
 * con la llave de servicio, y Franco las ve y las resuelve en /plataforma/denuncias.
 * Si la tabla todavía no existe o la base falla, la denuncia igual sale por
 * Telegram y mail: guardar nunca frena el aviso. La baja de una oferta
 * manifiestamente ilícita (pide plata, discrimina, involucra menores) la hace
 * Franco al recibir el aviso; el resto se revisa en 48 a 72 h (términos, cláusula 7).
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

export function esUrgente(m: MotivoDenuncia): boolean {
  return m === "pide_plata" || m === "ilegal" || m === "discrimina";
}

export interface DenunciaParaGuardar {
  tipo: "busqueda" | "oferta" | "perfil";
  openingId?: string | null;
  offerToken?: string | null;
  staffProfileId?: string | null;
  denuncianteUser?: string | null;
}

/**
 * Guarda la denuncia en staff_app.denuncias. Nunca tira: sin tabla (0105 sin
 * aplicar), sin llave o con la base caída devuelve false y lo deja en el log.
 * La oferta por link se identifica por el hash del token, igual que en la base.
 */
export async function guardarDenuncia(
  g: DenunciaParaGuardar,
  d: Parameters<typeof avisarDenuncia>[0],
): Promise<boolean> {
  try {
    const db = createServiceRoleClient().schema("staff_app");
    let offerId: string | null = null;
    let organizationId: string | null = null;
    if (g.offerToken) {
      const { createHash } = await import("node:crypto");
      const hash = createHash("sha256").update(g.offerToken).digest("hex");
      const { data } = await db.from("offers").select("id, organization_id").eq("token_hash", hash).maybeSingle();
      offerId = (data?.id as string | undefined) ?? null;
      organizationId = (data?.organization_id as string | undefined) ?? null;
    }
    if (g.openingId && !organizationId) {
      const { data } = await db.from("gig_openings").select("organization_id").eq("id", g.openingId).maybeSingle();
      organizationId = (data?.organization_id as string | undefined) ?? null;
    }
    const { error } = await db.from("denuncias").insert({
      tipo: g.tipo,
      opening_id: g.openingId ?? null,
      offer_id: offerId,
      staff_profile_id: g.staffProfileId ?? null,
      organization_id: organizationId,
      motivo: d.motivo,
      detalle: d.detalle?.trim() ? d.detalle.trim().slice(0, 500) : null,
      urgente: esUrgente(d.motivo),
      donde: d.donde,
      rol: d.rol ?? null,
      evento: d.evento ?? null,
      quien_publica: d.quienPublica ?? null,
      denunciante: d.denunciante ?? null,
      denunciante_user: g.denuncianteUser ?? null,
    });
    if (error) {
      console.error("[denuncias] no se guardó (¿0105 sin aplicar?):", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[denuncias] no se guardó:", e instanceof Error ? e.message : e);
    return false;
  }
}

/**
 * Guarda y avisa en paralelo. Vale como enviada si salió por CUALQUIER canal
 * (tabla, Telegram o mail).
 */
export async function registrarDenuncia(
  g: DenunciaParaGuardar,
  d: Parameters<typeof avisarDenuncia>[0],
): Promise<boolean> {
  const [guardada, avisada] = await Promise.all([guardarDenuncia(g, d), avisarDenuncia(d)]);
  return guardada || avisada;
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
  const urgente = esUrgente(d.motivo);
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
