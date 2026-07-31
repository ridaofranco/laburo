"use client";

/**
 * Navegación del portal (porteo FIEL del SideNavBar/BottomNavBar de Stitch
 * "Dashboard Productor"). Sidebar 280px en desktop, bottom-nav en mobile.
 * Estilos exactos de Stitch en valores arbitrarios. Ítems: Search/Offers/
 * Favorites/Events + Settings/Logout. Los que todavía no tienen pantalla
 * muestran un toast "Próximamente" (se van cableando a medida que se portean).
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  LayoutGrid,
  Search,
  CalendarDays,
  Heart,
  CalendarRange,
  TrendingUp,
  Wallet,
  Bell,
  Inbox,
  Settings,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LaburoWordmark } from "@/components/laburo-wordmark";

type Item = {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  href?: string;
  match?: string[]; // rutas que marcan este ítem como activo
};

const MAIN: Item[] = [
  { label: "Dashboard", icon: LayoutGrid, href: "/dashboard", match: ["/dashboard"] },
  // Leads arriba de todo lo operativo: es la plata que entra por la landing y no
  // sirve de nada guardarla si nadie la mira.
  { label: "Leads", icon: Inbox, href: "/leads", match: ["/leads"] },
  { label: "Buscar", icon: Search, href: "/buscar", match: ["/buscar", "/staff"] },
  { label: "Eventos", icon: CalendarDays, href: "/tablero", match: ["/tablero"] },
  { label: "Favoritos", icon: Heart, href: "/favoritos", match: ["/favoritos"] },
  { label: "Calendario", icon: CalendarRange, href: "/calendario", match: ["/calendario"] },
  { label: "Rentabilidad", icon: TrendingUp, href: "/rentabilidad", match: ["/rentabilidad"] },
  { label: "Pagos", icon: Wallet, href: "/pagos", match: ["/pagos"] },
  { label: "Notificaciones", icon: Bell, href: "/notificaciones", match: ["/notificaciones"] },
];

// En el bottom-nav mobile mostramos solo los primeros (los demás quedan en el sidebar desktop).
const MOBILE = MAIN.slice(0, 5);

function isActive(item: Item, pathname: string) {
  return (item.match ?? []).some((m) => pathname === m || pathname.startsWith(m + "/"));
}

export function PortalNav() {
  const pathname = usePathname();
  const router = useRouter();

  const soon = (label: string) => toast(`${label}: próximamente`);

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <>
      {/* Sidebar desktop */}
      <nav className="hidden md:flex flex-col h-screen py-8 fixed left-0 top-0 w-[280px] bg-[#0e0e0e]/90 backdrop-blur-2xl border-r border-[#1c1b1b] shadow-2xl z-40">
        <div className="px-8 mb-16">
          <LaburoWordmark className="h-[28px] w-auto" />
          <p className="label-tech text-[12px] text-[#cfc4c5] mt-2">Production Portal</p>
        </div>

        <ul className="flex flex-col gap-2 flex-1 w-full">
          {MAIN.map((item) => {
            const active = isActive(item, pathname);
            const cls = active
              ? "flex items-center gap-4 px-8 py-4 bg-[#1c1b1b] border-l-2 border-[#e5e2e1] text-[#e5e2e1] translate-x-1 transition-all duration-200"
              : "flex items-center gap-4 px-8 py-4 text-[#cfc4c5] hover:text-[#e5e2e1] hover:bg-[#1c1b1b]/50 transition-all";
            const inner = (
              <>
                <item.icon size={20} className="shrink-0" />
                <span className="label-tech text-[12px]">{item.label}</span>
              </>
            );
            return (
              <li key={item.label}>
                {item.href ? (
                  <Link href={item.href} className={cls}>{inner}</Link>
                ) : (
                  <button type="button" onClick={() => soon(item.label)} className={`w-full text-left ${cls}`}>{inner}</button>
                )}
              </li>
            );
          })}
        </ul>

        <div className="px-8 mt-auto border-t border-[#1c1b1b] pt-8">
          <ul className="flex flex-col gap-2">
            <li>
              <Link
                href="/config"
                className="w-full flex items-center gap-4 py-2 text-[#cfc4c5] hover:text-[#e5e2e1] transition-colors"
              >
                <Settings size={18} className="shrink-0" />
                <span className="label-tech text-[12px]">Ajustes</span>
              </Link>
            </li>
            <li>
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center gap-4 py-2 text-[#cfc4c5] hover:text-[#e5e2e1] transition-colors"
              >
                <LogOut size={18} className="shrink-0" />
                <span className="label-tech text-[12px]">Logout</span>
              </button>
            </li>
          </ul>
        </div>
      </nav>

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-4 left-4 right-4 bg-[#20201f]/90 backdrop-blur-xl border border-[#1c1b1b] shadow-2xl z-50 overflow-hidden">
        <ul className="flex justify-around items-center h-[72px] px-2">
          {MOBILE.map((item) => {
            const active = isActive(item, pathname);
            const cls = active
              ? "flex flex-col items-center justify-center bg-[#e5e2e1] text-black w-[90%] h-[90%] scale-95 duration-200"
              : "flex flex-col items-center justify-center text-[#cfc4c5] w-full h-full hover:bg-[#2a2a2a]/30 transition-colors";
            const inner = (
              <>
                <item.icon size={22} className="mb-1" />
                <span className="label-tech text-[10px]">{item.label}</span>
              </>
            );
            return (
              <li key={item.label} className="flex-1 flex justify-center">
                {item.href ? (
                  <Link href={item.href} className={cls}>{inner}</Link>
                ) : (
                  <button type="button" onClick={() => soon(item.label)} className={cls}>{inner}</button>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
