"use server";

/**
 * LA VIDRIERA PÚBLICA DE SALONES: el cuarto pool.
 *
 * Franco (6/8): *"podríamos sumar salones de eventos de manera gratuita, debería
 * ser un nuevo pool, VENUES/SALONES"*.
 *
 * ── POR QUÉ ES UNA VIDRIERA APARTE Y NO UN RUBRO MÁS DE /servicios ──────────
 * Porque un salón no se busca como un proveedor. A un proveedor se lo busca por
 * RUBRO ("necesito un fotógrafo"); a un salón se lo busca por CUÁNTA GENTE ENTRA
 * y DÓNDE QUEDA ("somos 180 y es en zona norte"). Meterlo en el mismo buscador
 * obligaba a elegir: o el filtro de capacidad no existía, o aparecía un campo
 * "cuántas personas" en una búsqueda de sonido, donde no significa nada.
 *
 * Hasta el 6/8 un salón solo podía publicarse como proveedor con el rubro
 * "Salones y espacios", o sea sin el único filtro con el que se lo busca.
 *
 * ── LA BASE YA ESTABA, LAS PANTALLAS NO ────────────────────────────────────
 * Las RPC son las de la migración 0064 (`staff_app_vidriera_salones` y
 * `staff_app_vidriera_salon`). La 0066 y la 0067 taparon lo que faltaba para que
 * el salón pudiera de verdad RECIBIR la consulta y volver a publicarse.
 *
 * Igual que en la vidriera de proveedores, ninguna de las dos funciones devuelve
 * el mail ni el teléfono del salón: si la consulta va por el formulario,
 * entregar igual la dirección deja abierta la puerta de atrás y nos deja sin el
 * registro.
 */

import { createClient } from "@/lib/supabase/server";

/** Lo que trae la búsqueda. No incluye datos de contacto, a propósito. */
export interface SalonPublico {
  slug: string;
  display_name: string | null;
  headline: string | null;
  bio: string | null;
  ciudad: string | null;
  provincia: string | null;
  is_verified: boolean;
  capacidad_min: number | null;
  capacidad_max: number | null;
  superficie_m2: number | null;
  amenities: string[];
  tipos_evento: string[];
  catering_propio: boolean | null;
  estacionamiento: boolean | null;
}

/** La ficha suma el id (para consultar), la dirección y las redes. */
export interface FichaSalon extends SalonPublico {
  profile_id: string;
  direccion: string | null;
  website: string | null;
  instagram: string | null;
  /** Las preguntas que arma el propio salón (provider_forms, vía 0066). */
  campos: import("@/lib/formulario-consulta").CampoFormulario[];
  intro: string | null;
}

export async function buscarSalones(filtros: {
  texto?: string;
  provincia?: string;
  personas?: number | null;
}): Promise<SalonPublico[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_app_vidriera_salones", {
    p_texto: filtros.texto?.trim() || null,
    p_provincia: filtros.provincia?.trim() || null,
    // 0 no es un filtro, es un campo vacío mal leído. Sin este guard, un
    // "0 personas" pediría un salón cuyo piso sea 0 y escondería medio
    // directorio sin que nadie entienda por qué.
    p_personas:
      filtros.personas != null && Number.isFinite(filtros.personas) && filtros.personas > 0
        ? Math.trunc(filtros.personas)
        : null,
  });
  if (error) {
    console.error("[salones] búsqueda pública falló:", error.message);
    return [];
  }
  return (data as SalonPublico[] | null) ?? [];
}

/**
 * La ficha de un salón, con su formulario.
 *
 * Son DOS llamadas y no una porque la 0064 dejó la ficha del salón sin
 * formulario (devuelve solo el salón). En vez de tocar una función que ya está
 * en vivo y probada, se lee el formulario con la misma RPC que usa la vidriera
 * de proveedores, que la 0066 abrió a los dos tipos. Van en paralelo, así que
 * cuesta un viaje, no dos.
 */
export async function getFichaSalon(slug: string): Promise<FichaSalon | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("staff_app_vidriera_salon", {
    p_slug: slug,
  });
  if (error) {
    console.error("[salones] ficha falló:", error.message);
    return null;
  }

  const r = data as (FichaSalon & { ok?: boolean }) | null;
  if (!r?.ok) return null;

  const { data: dataForm } = await supabase.rpc("staff_app_formulario_proveedor", {
    p_profile_id: r.profile_id,
  });
  const form = dataForm as {
    ok?: boolean;
    campos?: FichaSalon["campos"];
    intro?: string | null;
  } | null;

  return {
    ...r,
    campos: form?.ok ? (form.campos ?? []) : [],
    intro: form?.ok ? (form.intro ?? null) : null,
  };
}
