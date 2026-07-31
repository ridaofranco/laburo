/**
 * Ajustes (porteo del "Agency Settings" de Stitch) con DATOS REALES y HONESTOS.
 *
 * El mockup de Stitch traía datos inventados (agencia "LABURO Group", plan
 * "Enterprise", almacenamiento "45GB", 3 personas falsas). En un producto en vivo
 * eso es engañoso, así que se reemplaza por lo real del org (RLS-scopeado):
 *  - Perfil de la agencia = SOMOS DER (el dueño real del v1 interno), solo lectura
 *    (la edición es v2).
 *  - Resumen de la cuenta = plan interno sin costo + conteos reales del pool,
 *    eventos y ofertas (nada de facturación falsa: el producto es cero-costo).
 *  - Acceso del equipo = el usuario realmente logueado + su rol; invitar a más
 *    miembros es v2.
 *
 * Server component. Estilos exactos de Stitch en valores arbitrarios. El layout
 * del portal ya aporta el sidebar y el <main md:pl-[280px]>.
 */

import Link from "next/link";
import { Building2, Gauge, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { orgActual } from "@/lib/org";
import { initials } from "@/lib/avatar-color";

function roleLabel(role: string | null): string {
  switch ((role ?? "").toLowerCase()) {
    case "owner":
      return "Dueño";
    case "admin":
      return "Admin";
    case "writer":
      return "Editor";
    case "member":
      return "Miembro";
    default:
      return role?.trim() || "Miembro";
  }
}

export default async function ConfigPage() {
  const supabase = await createClient();

  const [{ data: userData }, org, pool, gigs, offers] = await Promise.all([
    supabase.auth.getUser(),
    orgActual(),
    supabase.from("staff_app_profiles").select("*", { count: "exact", head: true }),
    supabase.from("staff_app_gigs").select("*", { count: "exact", head: true }),
    supabase.from("staff_app_offers").select("*", { count: "exact", head: true }),
  ]);

  const email = userData?.user?.email ?? "—";
  const rol = roleLabel(org?.rol ?? null);
  // El nombre de la productora sale de la base, no de un literal. Con una sola
  // organización sigue diciendo SOMOS DER; con dos, cada uno ve la suya.
  const orgNombre = org?.nombre?.trim() || "SOMOS DER";
  // La marca grande: la última palabra del nombre ("SOMOS DER" → "DER"), que es
  // exactamente lo que se veía antes escrito a mano.
  const orgSigla = (orgNombre.split(/\s+/).pop() || orgNombre).toUpperCase();
  const nombreUsuario = email.split("@")[0] || "Vos";
  // "—" si la query falló (desconocido ≠ cero: no mostramos 0 engañoso).
  const poolCount = pool.error ? "—" : pool.count ?? 0;
  const gigsCount = gigs.error ? "—" : gigs.count ?? 0;
  const offersCount = offers.error ? "—" : offers.count ?? 0;

  return (
    <div className="max-w-[1440px] mx-auto w-full px-6 md:px-20 py-16 md:py-24">
      {/* Header */}
      <div className="mb-12">
        <h2 className="t-display text-[#e5e2e1] mb-2">
          Ajustes
        </h2>
        <p className="text-[18px] leading-[1.6] text-[#cfc4c5] max-w-[672px]">
          Los datos de tu organización, el estado de la cuenta y el acceso del
          equipo. La edición de perfil y las invitaciones llegan en una próxima
          versión.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Perfil de la agencia (8 cols) */}
        <section className="lg:col-span-8 flex flex-col gap-6">
          <div className="border border-[#1A1A1A] bg-[#0A0A0A] p-6 lg:p-10">
            <div className="flex items-center justify-between mb-8 pb-2 border-b border-[#1A1A1A]">
              <h3 className="t-section text-[#e5e2e1] flex items-center gap-3">
                <Building2 size={24} className="shrink-0" />
                Perfil de la agencia
              </h3>
              <span className="label-tech text-[11px] text-[#cfc4c5] uppercase tracking-[0.1em] border border-[#4c4546] px-2 py-1">
                Solo lectura
              </span>
            </div>

            <div className="flex flex-col md:flex-row gap-6 md:gap-12 items-start">
              {/* Logo/monograma */}
              <div className="w-32 h-32 shrink-0 border border-[#4c4546] grid place-items-center bg-[#131313]">
                <span className="t-stat-sm text-[#e5e2e1]">
                  {orgSigla}
                </span>
              </div>

              {/* Campos */}
              <div className="flex-1 w-full flex flex-col gap-8">
                <div>
                  <p className="label-tech text-[11px] text-[#cfc4c5] uppercase tracking-[0.1em] mb-2">
                    Nombre de la agencia
                  </p>
                  <p className="text-[18px] text-[#e5e2e1] border-b border-[#4c4546] pb-2">
                    {orgNombre}
                  </p>
                </div>
                <div>
                  <p className="label-tech text-[11px] text-[#cfc4c5] uppercase tracking-[0.1em] mb-2">
                    Qué hace
                  </p>
                  <p className="text-[18px] leading-[1.6] text-[#e5e2e1] border-b border-[#4c4546] pb-2">
                    Producción de eventos. LABURO es la herramienta para buscar,
                    contratar y coordinar staff eventual sobre el pool real de
                    postulantes.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-8">
                  <div className="flex-1">
                    <p className="label-tech text-[11px] text-[#cfc4c5] uppercase tracking-[0.1em] mb-2">
                      Ubicación
                    </p>
                    <p className="text-[16px] text-[#e5e2e1] border-b border-[#4c4546] pb-2">
                      Argentina
                    </p>
                  </div>
                  <div className="flex-1">
                    <p className="label-tech text-[11px] text-[#cfc4c5] uppercase tracking-[0.1em] mb-2">
                      Mercado v1
                    </p>
                    <p className="text-[16px] text-[#e5e2e1] border-b border-[#4c4546] pb-2">
                      Interno ({orgNombre})
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Resumen de la cuenta (4 cols) */}
        <section className="lg:col-span-4 flex flex-col gap-6">
          <div className="border border-[#1A1A1A] bg-[#0A0A0A] p-6 lg:p-10 h-full flex flex-col">
            <div className="flex items-center justify-between mb-8 pb-2 border-b border-[#1A1A1A]">
              <h3 className="t-section text-[#e5e2e1] flex items-center gap-3">
                <Gauge size={24} className="shrink-0" />
                Cuenta
              </h3>
            </div>

            <div className="flex-1 flex flex-col">
              <div className="bg-[#131313] border border-[#1A1A1A] p-6 mb-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="label-tech text-[11px] text-[#cfc4c5] uppercase tracking-[0.1em] mb-1">
                      Plan
                    </p>
                    <h4 className="font-[family-name:var(--font-syne)] text-[28px] font-semibold text-[#e5e2e1] leading-tight">
                      Interno
                    </h4>
                  </div>
                  <span className="bg-[#3dd68c]/10 text-[#3dd68c] border border-[#3dd68c]/30 px-2 py-1 label-tech text-[11px] uppercase tracking-[0.1em]">
                    Sin costo
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-[#4c4546]/50 pb-2">
                    <span className="text-[15px] text-[#cfc4c5]">Pool de staff</span>
                    <span className="text-[15px] text-[#e5e2e1]">{poolCount}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-[#4c4546]/50 pb-2">
                    <span className="text-[15px] text-[#cfc4c5]">Eventos</span>
                    <span className="text-[15px] text-[#e5e2e1]">{gigsCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[15px] text-[#cfc4c5]">Ofertas enviadas</span>
                    <span className="text-[15px] text-[#e5e2e1]">{offersCount}</span>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-2 flex flex-col gap-3">
                <Link
                  href="/buscar"
                  className="w-full text-center bg-transparent text-[#e5e2e1] label-tech text-[12px] py-3 px-4 border border-[#4c4546] hover:border-[#e5e2e1] transition-all duration-150 uppercase tracking-[0.1em]"
                >
                  Buscar staff
                </Link>
                <Link
                  href="/rentabilidad"
                  className="w-full text-center text-[#cfc4c5] label-tech text-[12px] py-2 px-4 hover:text-[#e5e2e1] transition-colors uppercase tracking-[0.1em]"
                >
                  Ver rentabilidad
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Acceso del equipo (12 cols) */}
        <section className="lg:col-span-12 mt-6">
          <div className="border border-[#1A1A1A] bg-[#0A0A0A] p-6 lg:p-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-2 border-b border-[#1A1A1A] gap-4">
              <h3 className="t-section text-[#e5e2e1] flex items-center gap-3">
                <ShieldCheck size={24} className="shrink-0" />
                Acceso del equipo
              </h3>
              <span className="label-tech text-[11px] text-[#cfc4c5] uppercase tracking-[0.1em] border border-[#4c4546] px-3 py-2">
                Invitar miembros: próximamente
              </span>
            </div>

            <div className="flex flex-col">
              <div className="hidden md:grid grid-cols-12 gap-4 pb-4 border-b border-[#1A1A1A] mb-4">
                <div className="col-span-6 label-tech text-[11px] text-[#cfc4c5] uppercase tracking-[0.1em]">
                  Usuario
                </div>
                <div className="col-span-3 label-tech text-[11px] text-[#cfc4c5] uppercase tracking-[0.1em]">
                  Rol
                </div>
                <div className="col-span-3 label-tech text-[11px] text-[#cfc4c5] uppercase tracking-[0.1em] text-right">
                  Estado
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center py-6">
                <div className="col-span-1 md:col-span-6 flex items-center gap-4">
                  <div className="h-10 w-10 flex items-center justify-center shrink-0 bg-[#c6c6c6]/20 border border-[#c6c6c6]/30">
                    <span className="label-tech text-[12px] text-[#c6c6c6]">
                      {initials(nombreUsuario)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[16px] text-[#e5e2e1] font-medium">Vos</p>
                    <p className="label-tech text-[12px] text-[#cfc4c5] truncate">{email}</p>
                  </div>
                </div>
                <div className="col-span-1 md:col-span-3">
                  <span className="inline-block px-2 py-1 label-tech text-[11px] uppercase tracking-[0.1em] border bg-[#c6c6c6]/10 text-[#c6c6c6] border-[#c6c6c6]/30">
                    {rol}
                  </span>
                </div>
                <div className="col-span-1 md:col-span-3 text-[15px] text-[#3dd68c] md:text-right">
                  Sesión activa
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
