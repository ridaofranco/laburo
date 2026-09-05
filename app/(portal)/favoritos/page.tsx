/**
 * Mis Favoritos (porteo FIEL de "Mis Favoritos - Minimalista Radical" de Stitch)
 * con DATOS REALES. Lista los candidatos marcados como favoritos (candidate_notes
 * is_favorite=true) con su perfil real: avatar de INICIALES sobre el tono del
 * oficio (el pool no tiene fotos, igual que en Buscar), nombre (Syne), oficio
 * principal (Geist), experiencia y disponibilidad reales, "VER PERFIL" al perfil
 * y botón de quitar. Server component RLS-scopeado al org del caller.
 *
 * El mockup de Stitch mostraba fotos stock + columnas TARIFA/DISP.; acá se
 * reemplazan por lo que sí existe en el pool: avatar de iniciales, EXPERIENCIA y
 * DISPONIBILIDAD reales. Estilos exactos de Stitch en valores arbitrarios.
 */

import Link from "next/link";
import { ListFilter } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { orgActual } from "@/lib/org";
import { oficioColor, initials } from "@/lib/avatar-color";
import { FavoriteRemoveButton } from "./favorite-remove-button";
import { LoadError } from "@/components/load-error";

interface NoteRow {
  staff_profile_id: string;
  note: string | null;
}

interface ProfileRow {
  id: string;
  nombre: string | null;
  apellido: string | null;
  oficios: string[] | null;
  provincia: string | null;
  ciudad: string | null;
  eventos_trabajados: number | null;
  anios_experiencia: string | null;
  disponibilidad_aviso: string | null;
}

/** Señal de experiencia real, o null si no hay dato. */
function experiencia(p: ProfileRow): string | null {
  if (p.eventos_trabajados && p.eventos_trabajados > 0) {
    return `${p.eventos_trabajados} ${p.eventos_trabajados === 1 ? "EVENTO" : "EVENTOS"}`;
  }
  const anios = (p.anios_experiencia ?? "").trim();
  if (anios) return anios.toUpperCase();
  return null;
}

/** Disponibilidad legible (mayúsculas), o null. */
function disponibilidad(p: ProfileRow): string | null {
  const d = (p.disponibilidad_aviso ?? "").trim();
  return d ? d.toUpperCase() : null;
}

export default async function FavoritosPage() {
  const supabase = await createClient();

  // ⚠️ Scope por organización elegida: la RLS filtra por MEMBRESÍA, así que con
  // dos membresías se mezclaban los favoritos de las dos productoras. El filtro
  // va acá, en las notas, que es lo que cuelga de la organización; los perfiles
  // se buscan después por id, así que quedan acotados por esta consulta.
  const org = await orgActual();
  const orgId = org?.organizationId ?? null;

  // 1. Favoritos del org (candidate_notes is_favorite=true), RLS-scopeado.
  let qNotes = supabase
    .from("staff_app_candidate_notes")
    .select("staff_profile_id,note")
    .eq("is_favorite", true);
  if (orgId) qNotes = qNotes.eq("organization_id", orgId);
  const { data: notesData, error } = await qNotes;

  const notes = (notesData ?? []) as NoteRow[];
  const noteById = new Map(notes.map((n) => [n.staff_profile_id, n.note]));
  const ids = notes.map((n) => n.staff_profile_id);

  // 2. Perfiles reales de esos ids (si hay favoritos).
  let profiles: ProfileRow[] = [];
  if (ids.length > 0) {
    const { data: profData } = await supabase
      .from("staff_app_profiles")
      .select(
        "id,nombre,apellido,oficios,provincia,ciudad,eventos_trabajados,anios_experiencia,disponibilidad_aviso",
      )
      .in("id", ids);
    profiles = (profData ?? []) as ProfileRow[];
    // Orden estable por nombre.
    profiles.sort((a, b) =>
      `${a.nombre ?? ""} ${a.apellido ?? ""}`.localeCompare(
        `${b.nombre ?? ""} ${b.apellido ?? ""}`,
        "es",
      ),
    );
  }

  const registros = String(profiles.length).padStart(2, "0");

  return (
    <div className="max-w-[1440px] mx-auto w-full px-6 md:px-20 py-16 md:py-24">
      {/* Header */}
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#4c4546] pb-8">
        <h1 className="t-display uppercase text-[#e5e2e1] break-words">
          FAVORITOS
        </h1>
        <div className="flex items-center gap-4 text-[#cfc4c5] label-tech text-[12px]">
          <span>{registros} REGISTROS</span>
          <ListFilter size={18} />
        </div>
      </header>

      {error ? (
        <LoadError what="los favoritos" />
      ) : profiles.length === 0 ? (
        // Estado vacío honesto.
        <div className="border-t border-b border-[#4c4546] py-20 text-center">
          <p className="text-[16px] text-[#cfc4c5] max-w-[420px] mx-auto">
            Todavía no marcaste a nadie como favorito. Guardá candidatos desde su
            perfil para tenerlos a mano acá.
          </p>
          <Link
            href="/buscar"
            className="mt-6 inline-block label-tech text-[12px] text-[#e5e2e1] hover:opacity-70 border-b border-[#4c4546] pb-1"
          >
            Buscar staff
          </Link>
        </div>
      ) : (
        <div className="flex flex-col">
          {profiles.map((p) => {
            const nombre =
              [p.nombre, p.apellido].filter(Boolean).join(" ").trim() || "Sin nombre";
            const primary = p.oficios?.[0] ?? "";
            const color = oficioColor(primary);
            const exp = experiencia(p);
            const disp = disponibilidad(p);
            const loc = [p.ciudad, p.provincia].filter(Boolean).join(", ");

            return (
              <div
                key={p.id}
                className="group flex flex-col md:flex-row md:items-center justify-between py-6 border-b border-[#4c4546] hover:border-b-[#e5e2e1] transition-colors duration-300 gap-6"
              >
                {/* Perfil */}
                <div className="flex items-center gap-8 min-w-0">
                  <div
                    className="w-16 h-16 md:w-24 md:h-24 shrink-0 grid place-items-center overflow-hidden"
                    style={{ backgroundColor: `${color}14` }}
                  >
                    <span
                      aria-hidden="true"
                      className="t-stat-sm"
                      style={{ color }}
                    >
                      {initials(p.nombre, p.apellido)}
                    </span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <h2 className="t-section uppercase text-[#e5e2e1] break-words">
                      {nombre}
                    </h2>
                    <p className="label-tech text-[12px] text-[#cfc4c5] mt-2">
                      {primary || (loc ? loc : "Sin oficio cargado")}
                    </p>
                  </div>
                </div>

                {/* Meta + acciones */}
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8 label-tech text-[12px]">
                  <div className="text-[#cfc4c5]">
                    <span className="block mb-1 opacity-50">EXPERIENCIA</span>
                    <span>{exp ?? "SIN DATO"}</span>
                  </div>
                  <div className="text-[#cfc4c5]">
                    <span className="block mb-1 opacity-50">DISP.</span>
                    <span>{disp ?? "A CONSULTAR"}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-4 md:mt-0">
                    <Link
                      href={`/staff/${p.id}`}
                      className="bg-[#e5e2e1] text-[#131313] border border-transparent hover:bg-transparent hover:text-[#e5e2e1] hover:border-[#e5e2e1] transition-all duration-150 label-tech text-[12px] px-6 py-3 tracking-[0.1em]"
                    >
                      VER PERFIL
                    </Link>
                    <FavoriteRemoveButton
                      staffProfileId={p.id}
                      note={noteById.get(p.id) ?? null}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
