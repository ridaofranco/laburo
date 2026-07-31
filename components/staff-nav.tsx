"use client";

/**
 * Navegación del PORTAL DE STAFF (fork "staff con cuenta"). Chrome propio del
 * lado staff (NO el sidebar del productor): sidenav desktop 280px + topbar mobile
 * + bottom-nav mobile, tal cual la estética Stitch del panel-staff, pero con
 * LINKS REALES (Panel / Fichaje / Perfil) activos por ruta y logout real.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, MapPin, UserRound, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LaburoWordmark } from "@/components/laburo-wordmark";

const ITEMS = [
  { href: "/panel-staff", label: "Mis eventos", icon: CalendarDays },
  { href: "/fichaje", label: "Fichaje", icon: MapPin },
  { href: "/editar-perfil-staff", label: "Mi perfil", icon: UserRound },
];

export function StaffNav() {
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/acceso-staff");
    router.refresh();
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* SideNav desktop */}
      <nav className="hidden md:flex flex-col h-screen py-8 fixed left-0 top-0 w-[280px] bg-[#0e0e0e]/90 backdrop-blur-2xl border-r border-[#1A1A1A] shadow-2xl z-40">
        <div className="px-6 mb-12">
          <LaburoWordmark className="h-[22px] w-auto" />
          <p className="label-tech text-[12px] text-[#cfc4c5] uppercase mt-1">Portal de Staff</p>
        </div>
        <div className="flex-1 flex flex-col gap-2">
          {ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-3 transition-all ${
                  active
                    ? "bg-white/5 border-l-4 border-[#c6c6c6] text-[#c6c6c6] translate-x-1 duration-200"
                    : "text-[#cfc4c5] hover:text-[#c6c6c6] hover:bg-white/5"
                }`}
              >
                <Icon size={20} />
                <span className={`text-[14px] ${active ? "font-bold" : ""}`}>{label}</span>
              </Link>
            );
          })}
        </div>
        <div className="mt-auto flex flex-col gap-2 px-4">
          <div className="w-full h-px bg-[#1A1A1A] my-4" />
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 text-[#cfc4c5] hover:text-[#c6c6c6] hover:bg-white/5 transition-all text-left"
          >
            <LogOut size={20} />
            <span className="text-[14px]">Salir</span>
          </button>
        </div>
      </nav>

      {/* TopNav mobile */}
      <header className="md:hidden flex justify-between items-center px-6 py-4 w-full h-16 bg-[#131313]/80 backdrop-blur-xl border-b border-[#1A1A1A] top-0 z-40 fixed">
        <LaburoWordmark className="h-[22px] w-auto" />
        <button
          type="button"
          onClick={logout}
          aria-label="Salir"
          className="hover:bg-white/5 transition-colors p-2 rounded-full text-[#c6c6c6]"
        >
          <LogOut size={22} />
        </button>
      </header>

      {/* BottomNav mobile */}
      <nav className="md:hidden fixed bottom-0 w-full z-50 flex justify-around items-center px-4 pb-6 h-[80px] bg-[#20201f]/80 backdrop-blur-lg border-t border-[#1A1A1A]">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors ${
                active ? "text-[#c6c6c6]" : "text-[#cfc4c5] hover:bg-white/5"
              }`}
            >
              <Icon size={22} className="mb-1" />
              <span className={`text-[10px] ${active ? "font-bold" : ""}`}>{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
