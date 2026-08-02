"use server";

/**
 * Buscar proveedores en el marketplace (Fase 3), del lado de la productora.
 *
 * La búsqueda CRUZA organizaciones a propósito: un proveedor publicado lo ve
 * cualquier productora. Es la misma Regla 1 que Franco eligió para el pool de
 * personas (2/8). Lo que no cruza es la nota interna y el favorito, que siguen
 * siendo de cada productora.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ServicioProveedor {
  categoria: string;
  titulo: string;
  descripcion: string | null;
  precio_desde: number | null;
  moneda: string;
  unidad: string | null;
  provincias: string[];
}

export interface Proveedor {
  profile_id: string;
  display_name: string | null;
  headline: string | null;
  bio: string | null;
  ciudad: string | null;
  provincia: string | null;
  website: string | null;
  instagram: string | null;
  email: string | null;
  telefono: string | null;
  is_verified: boolean;
  servicios: ServicioProveedor[];
  es_favorito: boolean;
  nota_interna: string | null;
  ya_contactado: boolean;
}

export async function buscarProveedores(filtros: {
  texto?: string;
  categoria?: string;
  provincia?: string;
}): Promise<Proveedor[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("staff_app_buscar_proveedores", {
    p_texto: filtros.texto?.trim() || null,
    p_categoria: filtros.categoria?.trim() || null,
    p_provincia: filtros.provincia?.trim() || null,
  });
  return (data as Proveedor[] | null) ?? [];
}

export async function getCategorias(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("staff_app_categorias_proveedores");
  return (data as string[] | null) ?? [];
}

export async function contactarProveedor(
  profileId: string,
  mensaje?: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_app_contactar_proveedor", {
    p_profile_id: profileId,
    p_mensaje: mensaje?.trim() || null,
    p_gig_id: null,
  });
  if (error) {
    console.error("[proveedores] contactar falló:", error.message);
    return { ok: false, error: "No se pudo. Probá de nuevo." };
  }
  const r = data as { ok?: boolean; reason?: string } | null;
  if (!r?.ok) {
    return {
      ok: false,
      error:
        r?.reason === "sin_permiso"
          ? "No tenés permiso para esto."
          : r?.reason === "no_disponible"
            ? "Ese proveedor ya no está publicado."
            : "No se pudo. Probá de nuevo.",
    };
  }
  revalidatePath("/proveedores");
  return { ok: true };
}
