import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { orgActual, orgsDelUsuario } from "@/lib/org";
import { AccesoDenegado } from "../(app)/acceso-denegado";
import { PortalNav } from "./portal-nav";
import { BannerSuplantacion } from "./banner-suplantacion";

/**
 * Layout del portal del productor (porteo del SideNavBar de Stitch). Mismo gate
 * de auth + membresía que el (app) layout: la RLS de staff_app es la autoridad
 * real; esto es defensa en profundidad. La navegación es el sidebar (desktop) +
 * bottom-nav (mobile) de <PortalNav>. Las pantallas del portal viven acá adentro.
 */
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Membresía vía orgActual(): soporta que el usuario pertenezca a más de una
  // productora (acompañamiento de aliadas, Fase 2). Antes era un .maybeSingle()
  // que con dos membresías tiraba PGRST116 y dejaba el portal entero sin cargar.
  const org = await orgActual();
  if (!org) return <AccesoDenegado />;

  // Todas sus organizaciones, para el selector de contexto. Con una sola el
  // selector no se dibuja (ver org-selector.tsx), así que esto no agrega ruido
  // al caso de hoy; con dos o más es lo que permite elegir en nombre de quién
  // se actúa, que es a dónde van las escrituras.
  const orgs = await orgsDelUsuario();

  return (
    <div className="min-h-dvh bg-black text-[#e5e2e1]">
      {/* El nav necesita saber DE QUIÉN es este panel (para decirlo en la barra
          lateral) y si el que mira es la plataforma (para no ofrecerle pantallas
          que no son de su producto). Filtrar el menú es cosmético: el gate de
          verdad vive en la página y en la server action. */}
      <PortalNav
        esPlataforma={org.esPlataforma}
        orgNombre={org.nombre}
        /* Suplantando NO hay selector: la organización la fija la sesión de
           suplantación, y ofrecer un cambio de contexto ahí adentro es un
           estado que no queremos que exista. Se sale del banner y se elige
           después. */
        orgs={
          org.suplantada
            ? []
            : orgs
                .filter((o) => o.organizationId)
                .map((o) => ({ id: o.organizationId as string, nombre: o.nombre ?? "Productora" }))
        }
        orgActualId={org.organizationId}
      />
      <div className="flex-1 flex flex-col min-h-dvh w-full md:pl-[280px] pb-32 md:pb-0">
        {/* Invariante 4 de la 0073: visible en TODAS las pantallas del portal.
            Va acá y no adentro de cada página justamente para que no haya
            ninguna pantalla donde se pueda olvidar. */}
        {org.suplantada && <BannerSuplantacion nombre={org.nombre} />}
        <main className="flex-1 flex flex-col w-full">{children}</main>
      </div>
    </div>
  );
}
