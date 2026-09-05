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
  Truck,
  Shield,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LaburoWordmark } from "@/components/laburo-wordmark";

type Item = {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  href?: string;
  match?: string[]; // rutas que marcan este ítem como activo
  /** Pantalla de la plataforma (SOMOS DER), no del producto de una productora. */
  soloPlataforma?: boolean;
};

const MAIN: Item[] = [
  { label: "Dashboard", icon: LayoutGrid, href: "/dashboard", match: ["/dashboard"] },
  // Leads arriba de todo lo operativo: es la plata que entra por la landing y no
  // sirve de nada guardarla si nadie la mira. Es de PLATAFORMA: solo lo ve la
  // org dueña del producto (se filtra abajo, en el componente).
  { label: "Leads", icon: Inbox, href: "/leads", match: ["/leads"], soloPlataforma: true },
  // Plataforma va PEGADO a Leads y no al final porque es el paraguas de todo lo
  // demas: la pantalla que mira las productoras desde arriba. Escondida detras
  // de las operativas quedaria enterrada, y hasta hoy no habia ningun link: se
  // llegaba escribiendo la URL a mano.
  // Icono Shield y no Globe ni Radio: lo que hace esta pantalla es moderar y
  // dar de baja lo que este mal, no transmitir ni hablar de mercados.
  // ⚠️ Ojo: /plataforma NO vive en app/(portal)/, tiene su propio <main> y no
  // recibe esta barra. Es un link que SALE del portal, y por eso la pantalla
  // tiene su propio link de vuelta en el header.
  { label: "Plataforma", icon: Shield, href: "/plataforma", match: ["/plataforma"], soloPlataforma: true },
  { label: "Buscar", icon: Search, href: "/buscar", match: ["/buscar", "/staff"] },
  // Fase 3 (2/8): "si a la productora le faltan proveedores, que puedan
  // tenerlos". Va PEGADO a Buscar porque son la misma pregunta con distinta
  // respuesta: me falta gente / me falta un servicio.
  { label: "Proveedores", icon: Truck, href: "/proveedores", match: ["/proveedores"] },
  { label: "Eventos", icon: CalendarDays, href: "/tablero", match: ["/tablero"] },
  { label: "Favoritos", icon: Heart, href: "/favoritos", match: ["/favoritos"] },
  { label: "Calendario", icon: CalendarRange, href: "/calendario", match: ["/calendario"] },
  // Franco, 3/8: "eso es interno mío". Es de PLATAFORMA, igual que Leads: una
  // productora cliente no tiene por qué ver una pantalla que le habla del margen
  // del negocio. El arreglo se hizo el 3/8 y se perdió sin llegar a mergearse
  // (la rama fix/login-rentabilidad-logo ya no existe); se rehizo el 6/8.
  { label: "Rentabilidad", icon: TrendingUp, href: "/rentabilidad", match: ["/rentabilidad"], soloPlataforma: true },
  { label: "Pagos", icon: Wallet, href: "/pagos", match: ["/pagos"] },
  { label: "Notificaciones", icon: Bell, href: "/notificaciones", match: ["/notificaciones"] },
];

function isActive(item: Item, pathname: string) {
  return (item.match ?? []).some((m) => pathname === m || pathname.startsWith(m + "/"));
}

export function PortalNav({
  esPlataforma = false,
  orgNombre = null,
}: {
  esPlataforma?: boolean;
  orgNombre?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Los ítems que ve el que mira. Una productora cliente no ve las pantallas de
  // plataforma. Esto es cosmético: el gate real está en la página y en la
  // server action de cada una.
  const items = esPlataforma ? MAIN : MAIN.filter((i) => !i.soloPlataforma);
  // El bottom-nav mobile son los primeros cinco. Se corta acá adentro, sobre la
  // lista YA filtrada: si se calculara a nivel de módulo (como estaba), el
  // mobile quedaría desalineado con el sidebar y le ofrecería Leads a alguien
  // que no lo tiene en el sidebar.
  // ⚠️ Con Plataforma adentro, para la cuenta de plataforma este slice esconde
  // SEIS de once pantallas en el teléfono. No se arregla acá: es otro issue (el
  // menú "Más"), y ningún commit mezcla dos.
  const mobile = items.slice(0, 5);

  // De quién es este panel. Antes había acá una etiqueta genérica en inglés,
  // resto del mockup de Stitch: la barra lateral no decía de quién era el panel.
  const bajada = orgNombre?.trim() || "Panel de productora";

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
          <p className="label-tech text-[12px] text-[#cfc4c5] mt-2">{bajada}</p>
        </div>

        <ul className="flex flex-col gap-2 flex-1 w-full">
          {items.map((item) => {
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
          {mobile.map((item) => {
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
