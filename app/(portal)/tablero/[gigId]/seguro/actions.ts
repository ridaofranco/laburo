"use server";

/**
 * Asegurar al equipo de un evento con MeCubro (0109). Franco 06/11: la
 * productora asegura a la gente que aceptó su oferta y paga DIRECTO a MeCubro
 * (link de MercadoPago de MeCubro). LABURO no cobra nada en el medio.
 *
 * Seguridad: la vista staff_app_gigs tiene RLS, así que si quien llama no es de
 * la organización del evento, el gig no existe para él y no se hace nada. Recién
 * ahí se usan las funciones solo-servidor de la 0109.
 */

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { contratar, cotizar, estado, mecubroActivo, mecubroAmbiente, type Asegurado } from "@/lib/mecubro";
import { cuitValido } from "@/lib/documento";
import { siteUrl } from "@/lib/site";
import { revalidatePath } from "next/cache";

export interface PersonaSeguro {
  staff_profile_id: string;
  nombre: string | null;
  apellido: string | null;
  documento: string | null;
  documento_tipo: string | null;
  fecha_nacimiento: string | null;
  genero: string | null;
  rol: string | null;
}

export interface SeguroGuardado {
  id: string;
  ambiente: string;
  mecubro_insurance_id: number;
  mecubro_uuid: string;
  codigo: string | null;
  estado: string;
  total: number | null;
  link_pago: string | null;
  cobertura: string | null;
  vigencia_desde: string;
  vigencia_hasta: string;
  personas: string[];
  beneficiario_nombre: string | null;
  pagado_at: string | null;
  created_at: string;
}

export interface GigSeguro {
  id: string;
  title: string | null;
  starts_at: string | null;
  ends_at: string | null;
  organization_id: string;
}

/** Fecha AAAA-MM-DD en hora argentina. MeCubro cubre de 00:00 a 23:59 de cada día. */
function diaAR(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(iso));
}

export async function vigenciaDe(gig: { starts_at: string | null; ends_at: string | null }) {
  if (!gig.starts_at) return null;
  const desde = diaAR(gig.starts_at);
  // Si termina pasada la medianoche, se cubre también ese día.
  const hasta = gig.ends_at ? diaAR(gig.ends_at) : desde;
  return { desde, hasta: hasta < desde ? desde : hasta };
}

export async function gigDelUsuario(gigId: string): Promise<GigSeguro | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_app_gigs")
    .select("id,title,starts_at,ends_at,organization_id")
    .eq("id", gigId)
    .maybeSingle();
  return (data as GigSeguro | null) ?? null;
}

export async function datosSeguro(gigId: string) {
  const gig = await gigDelUsuario(gigId);
  if (!gig) return null;
  const admin = createServiceRoleClient();
  const [{ data: personas, error: e1 }, { data: seguros, error: e2 }] = await Promise.all([
    admin.rpc("staff_app_seguro_personas", { p_gig: gigId }),
    admin.rpc("staff_app_seguros_del_gig", { p_gig: gigId }),
  ]);
  if (e1 || e2) console.error("[seguro] no se pudo leer:", e1?.message ?? "", e2?.message ?? "");
  const lista = ((seguros as SeguroGuardado[] | null) ?? []).filter((s) => s.ambiente === mecubroAmbiente());

  // Sin webhooks: al abrir la pantalla se pregunta a MeCubro por los que siguen abiertos.
  if (mecubroActivo()) {
    await Promise.all(
      lista
        .filter((s) => !s.pagado_at && s.estado !== "cancel")
        .map(async (s) => {
          try {
            const e = await estado(s.mecubro_insurance_id);
            if (e.estado !== s.estado || e.pagado) {
              await admin.rpc("staff_app_seguro_actualizar", { p_id: s.id, p_estado: e.estado, p_total: e.total, p_pagado: e.pagado });
              s.estado = e.estado;
              if (e.pagado) s.pagado_at = new Date().toISOString();
            }
          } catch (err) {
            console.error("[seguro] estado MeCubro:", err instanceof Error ? err.message : String(err));
          }
        }),
    );
  }

  let coberturas: { id: number; nombre: string }[] = [];
  let errorCotizar: string | null = null;
  const vig = await vigenciaDe(gig);
  const ps = (personas as PersonaSeguro[] | null) ?? [];
  if (mecubroActivo() && vig && ps.length) {
    try {
      coberturas = await cotizar(vig.desde, vig.hasta, ps.map((p) => p.rol ?? ""));
    } catch (err) {
      errorCotizar = err instanceof Error ? err.message : String(err);
      console.error("[seguro] cotizar:", errorCotizar);
    }
  }
  return { gig, personas: ps, seguros: lista, coberturas, errorCotizar, vigencia: vig, activo: mecubroActivo(), ambiente: mecubroAmbiente() };
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export async function asegurar(
  gigId: string,
  input: {
    coverageId: number;
    coberturaNombre: string;
    personas: (Omit<Asegurado, "rol"> & { staff_profile_id: string })[];
    beneficiario: { nombre: string; cuit: string } | null;
  },
): Promise<{ ok: true; linkPago: string } | { ok: false; error: string }> {
  if (!mecubroActivo()) return { ok: false, error: "El seguro con MeCubro todavía no está activado." };
  const gig = await gigDelUsuario(gigId);
  if (!gig) return { ok: false, error: "Ese evento no existe o no es tuyo." };
  const vig = await vigenciaDe(gig);
  if (!vig) return { ok: false, error: "El evento no tiene fecha: cargala antes de asegurar." };
  if (!input.personas.length) return { ok: false, error: "Elegí al menos una persona." };

  // Solo gente que de verdad aceptó una oferta de ESTE evento.
  const admin = createServiceRoleClient();
  const { data: aceptadas } = await admin.rpc("staff_app_seguro_personas", { p_gig: gigId });
  const porId = new Map(((aceptadas as PersonaSeguro[] | null) ?? []).map((p) => [p.staff_profile_id, p]));
  const asegurados: Asegurado[] = [];
  for (const p of input.personas) {
    const base = porId.get(p.staff_profile_id);
    if (!base) return { ok: false, error: "Hay una persona que no aceptó oferta en este evento." };
    const doc = (p.documento || "").replace(/\D/g, "");
    const quien = `${p.nombre} ${p.apellido}`.trim();
    if (!p.nombre.trim() || !p.apellido.trim()) return { ok: false, error: `Falta nombre o apellido de ${quien || "una persona"}.` };
    if (p.documento_tipo === "DNI" && (doc.length < 7 || doc.length > 8)) return { ok: false, error: `El DNI de ${quien} tiene que tener 7 u 8 números.` };
    if (!doc) return { ok: false, error: `Falta el documento de ${quien}.` };
    if (!FECHA.test(p.nacimiento)) return { ok: false, error: `Falta la fecha de nacimiento de ${quien}.` };
    if (p.genero !== "f" && p.genero !== "m") return { ok: false, error: `Falta el género de ${quien} (lo pide la aseguradora).` };
    asegurados.push({ ...p, documento: doc, nombre: p.nombre.trim(), apellido: p.apellido.trim(), rol: base.rol ?? "" });
  }
  let beneficiario: { nombre: string; cuit: string } | null = null;
  if (input.beneficiario && (input.beneficiario.nombre.trim() || input.beneficiario.cuit.trim())) {
    const cuit = input.beneficiario.cuit.replace(/\D/g, "");
    if (!input.beneficiario.nombre.trim()) return { ok: false, error: "Escribí la razón social de la cláusula de no repetición." };
    if (!cuitValido(cuit)) return { ok: false, error: "El CUIT de la cláusula de no repetición no es válido." };
    beneficiario = { nombre: input.beneficiario.nombre.trim(), cuit };
  }

  try {
    const r = await contratar({
      desde: vig.desde,
      hasta: vig.hasta,
      coverageId: input.coverageId,
      personas: asegurados,
      beneficiario,
      volverA: siteUrl(`/tablero/${gigId}/seguro`),
    });
    const supabase = await createClient();
    const { data: u } = await supabase.auth.getUser();
    const { error } = await admin.rpc("staff_app_seguro_guardar", {
      p: {
        organization_id: gig.organization_id,
        gig_id: gigId,
        ambiente: mecubroAmbiente(),
        mecubro_insurance_id: r.insuranceId,
        mecubro_uuid: r.uuid,
        codigo: r.codigo,
        estado: r.estado,
        total: r.total,
        link_pago: r.linkPago,
        coverage_id: input.coverageId,
        cobertura: input.coberturaNombre,
        vigencia_desde: vig.desde,
        vigencia_hasta: vig.hasta,
        personas: input.personas.map((p) => p.staff_profile_id),
        beneficiario_nombre: beneficiario?.nombre ?? null,
        beneficiario_cuit: beneficiario?.cuit ?? null,
        creado_por: u.user?.id ?? null,
      },
    });
    if (error) console.error("[seguro] no se guardó en la base:", error.message);
    revalidatePath(`/tablero/${gigId}/seguro`);
    return { ok: true, linkPago: r.linkPago };
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    console.error("[seguro] contratar:", m);
    return { ok: false, error: `MeCubro no aceptó el pedido. ${m.replace(/^MeCubro \d+: /, "")}` };
  }
}
