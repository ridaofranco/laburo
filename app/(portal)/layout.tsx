import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccesoDenegado } from "../(app)/acceso-denegado";
import { PortalNav } from "./portal-nav";

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

  const { data: membership } = await supabase
    .from("staff_app_my_membership")
    .select("role")
    .maybeSingle();

  if (!membership) return <AccesoDenegado />;

  return (
    <div className="min-h-dvh bg-black text-[#e5e2e1]">
      <PortalNav />
      <main className="flex-1 flex flex-col min-h-dvh w-full md:pl-[280px] pb-32 md:pb-0">
        {children}
      </main>
    </div>
  );
}
