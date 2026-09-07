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
import { Gauge } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { orgActual } from "@/lib/org";
import { leerPerfil } from "./perfil-actions";
import { leerEquipo } from "./equipo-actions";
import { EquipoPanel } from "./equipo-panel";
import { PerfilForm } from "./perfil-form";


export default async function ConfigPage() {
  const supabase = await createClient();

  // ⚠️ Los tres conteos salían de vistas con RLS por MEMBRESÍA, así que a quien
  // fuera miembro de dos productoras le SUMABAN las dos y decían un número que
  // no correspondía a ninguna. Ahora cuentan la organización elegida.
  const [{ data: userData }, org] = await Promise.all([
    supabase.auth.getUser(),
    orgActual(),
  ]);
  const orgId = org?.organizationId ?? null;

  let qPool = supabase.from("staff_app_profiles").select("*", { count: "exact", head: true });
  if (orgId) qPool = qPool.eq("organization_id", orgId);
  let qGigs = supabase.from("staff_app_gigs").select("*", { count: "exact", head: true });
  if (orgId) qGigs = qGigs.eq("organization_id", orgId);
  let qOffers = supabase.from("staff_app_offers").select("*", { count: "exact", head: true });
  if (orgId) qOffers = qOffers.eq("organization_id", orgId);

  const [pool, gigs, offers, perfil, equipo] = await Promise.all([
    qPool, qGigs, qOffers, leerPerfil(), leerEquipo(),
  ]);

  const email = userData?.user?.email ?? "—";
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
          equipo.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Perfil de la agencia (8 cols) — ahora EDITABLE.
          *
          * ⚠️ ACÁ HABÍA UNA TARJETA FIJA Y MENTÍA. Mostraba, para toda
          * productora, un "Qué hace" escrito a mano que describía a LABURO, y
          * "Ubicación: Argentina". Venía de cuando LABURO era interno de SOMOS
          * DER y esos datos eran los del único dueño; con más de una
          * organización adentro pasó a ser un dato falso. Los campos ahora
          * viven en la base (migración 0083) y los edita la propia productora. */}
        <section className="lg:col-span-8 flex flex-col gap-6">
          {perfil ? (
            <PerfilForm perfil={perfil} sigla={orgSigla} />
          ) : (
            <div className="border border-[#1A1A1A] bg-[#0A0A0A] p-6 lg:p-10">
              <p className="text-[16px] text-[#cfc4c5]">
                No pudimos cargar el perfil de tu organización. Recargá la
                página; si sigue igual, escribinos.
              </p>
            </div>
          )}
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
                  {/* ⚠️ `shrink-0 whitespace-nowrap` NO ES DECORATIVO. Lo marcó
                    * Franco el 7/9/2026 con dos capturas: al 90% de zoom el badge
                    * entra en una línea, al 100% se parte en "SIN / COSTO" y se
                    * encima sobre "Interno". El contenedor es un flex y este
                    * span era el único elemento sin protección: al achicarse el
                    * ancho disponible, flex lo comprime a él (es el más chico) y
                    * el texto busca una segunda línea que no tiene lugar. */}
                  <span className="shrink-0 whitespace-nowrap bg-[#3dd68c]/10 text-[#3dd68c] border border-[#3dd68c]/30 px-2 py-1 label-tech text-[11px] uppercase tracking-[0.1em]">
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
                {/* ⚠️ ACÁ HABÍA UN "VER RENTABILIDAD" Y SE SACÓ (7/9/2026, Franco:
                  * "eso de ver rentabilidad no estaría funcionando y no sería
                  * necesario ahora"). Además contradecía una decisión del 3/8:
                  * Rentabilidad es una pantalla de PLATAFORMA ("eso es interno
                  * mío"), está marcada `soloPlataforma` en el menú, y este botón
                  * la ofrecía desde una tarjeta que ve cualquier productora. La
                  * pantalla no se toca: lo que se saca es la puerta de acá. */}
              </div>
            </div>
          </div>
        </section>

        {/* Acceso del equipo (12 cols) — invitar YA FUNCIONA.
          *
          * ⚠️ ACÁ HABÍA UN CARTEL DE "INVITAR MIEMBROS: PRÓXIMAMENTE" y una
          * lista de una sola fila (el usuario logueado). El efecto práctico era
          * que una productora se quedaba sola adentro: el único que entraba era
          * quien creó la cuenta. Ahora se invita por mail con un link que vale
          * 14 días, se cambia el rol y se saca gente (migración 0084). */}
        <section className="lg:col-span-12 mt-6">
          <EquipoPanel equipo={equipo} emailPropio={email} />
        </section>
      </div>
    </div>
  );
}
