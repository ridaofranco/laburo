/**
 * Panel del STAFF (la persona que trabaja en eventos). Porteo FIEL de la
 * pantalla Stitch "Dashboard - Staff" de LABURO. STANDALONE: trae su propio
 * chrome (sidenav desktop, topbar mobile, bottom-nav mobile) tal cual el HTML,
 * NO usa el sidebar del portal del productor. Estilos exactos de Stitch en
 * valores arbitrarios. Copy traducido a voseo rioplatense, sin guión largo.
 * Datos de ejemplo estáticos. Server component.
 */
import {
  Search,
  Tag,
  Heart,
  CalendarDays,
  Settings,
  LogOut,
  Bell,
  ArrowRight,
} from "lucide-react";

const SYNE = "font-[family-name:var(--font-syne)]";

const proposals = [
  {
    date: "15 Oct 2024",
    title: "Concierto Sinfónico en el Parque",
    role: "Asistente de Sonido",
    hours: "8 hs",
  },
  {
    date: "22 Oct 2024",
    title: "Feria Gastronómica Nacional",
    role: "Coordinador de Logística",
    hours: "12 hs",
  },
  {
    date: "05 Nov 2024",
    title: "Cumbre de Innovación Tech",
    role: "Acreditaciones",
    hours: "6 hs",
  },
];

const sideNav = [
  { icon: Search, label: "Buscar" },
  { icon: Tag, label: "Ofertas" },
  { icon: Heart, label: "Favoritos" },
];

export default function PanelStaffPage() {
  return (
    <div className="min-h-dvh bg-[#131313] text-[#e5e2e1] font-sans antialiased flex flex-col md:flex-row">
      {/* SideNav desktop */}
      <nav className="hidden md:flex flex-col h-screen py-8 fixed left-0 top-0 w-[280px] bg-[#0e0e0e]/90 backdrop-blur-2xl border-r border-[#1A1A1A] shadow-2xl z-40">
        <div className="px-6 mb-12">
          <h1 className={`${SYNE} text-[24px] font-bold text-[#c6c6c6] tracking-tighter`}>
            LABURO.
          </h1>
          <p className="label-tech text-[12px] text-[#cfc4c5] uppercase mt-1">
            Portal de Staff
          </p>
        </div>
        <div className="flex-1 flex flex-col gap-2">
          {sideNav.map(({ icon: Icon, label }) => (
            <a
              key={label}
              href="#"
              className="flex items-center gap-3 px-4 py-3 text-[#cfc4c5] hover:text-[#c6c6c6] hover:bg-white/5 transition-all"
            >
              <Icon size={20} />
              <span className="text-[14px]">{label}</span>
            </a>
          ))}
          <a
            href="#"
            className="flex items-center gap-3 px-4 py-3 bg-white/5 border-l-4 border-[#c6c6c6] text-[#c6c6c6] transition-all translate-x-1 duration-200"
          >
            <CalendarDays size={20} />
            <span className="text-[14px] font-bold">Eventos</span>
          </a>
        </div>
        <div className="mt-auto flex flex-col gap-2 px-4">
          <div className="w-full h-px bg-[#1A1A1A] my-4" />
          <a
            href="#"
            className="flex items-center gap-3 px-4 py-3 text-[#cfc4c5] hover:text-[#c6c6c6] hover:bg-white/5 transition-all"
          >
            <Settings size={20} />
            <span className="text-[14px]">Ajustes</span>
          </a>
          <a
            href="#"
            className="flex items-center gap-3 px-4 py-3 text-[#cfc4c5] hover:text-[#c6c6c6] hover:bg-white/5 transition-all"
          >
            <LogOut size={20} />
            <span className="text-[14px]">Salir</span>
          </a>
        </div>
      </nav>

      {/* TopNav mobile */}
      <header className="md:hidden flex justify-between items-center px-6 py-4 w-full h-16 bg-[#131313]/80 backdrop-blur-xl border-b border-[#1A1A1A] top-0 z-40 fixed">
        <h1 className={`${SYNE} text-[24px] tracking-tighter text-[#c6c6c6]`}>LABURO.</h1>
        <div className="flex items-center gap-4 text-[#c6c6c6]">
          <button className="hover:bg-white/5 transition-colors p-2 rounded-full">
            <Bell size={22} />
          </button>
          <button className="hover:bg-white/5 transition-colors p-2 rounded-full">
            <Settings size={22} />
          </button>
        </div>
      </header>

      {/* Canvas principal */}
      <main className="flex-1 w-full md:pl-[280px] pt-16 md:pt-0 pb-[80px] md:pb-0 relative">
        <div className="max-w-[1440px] mx-auto px-6 md:px-20 py-12 md:py-40 flex flex-col gap-12">
          {/* Hero / métricas clave */}
          <section className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
            <div className="col-span-1 md:col-span-8 flex flex-col gap-2">
              <p className="label-tech text-[12px] uppercase tracking-[0.2em] text-[#c6c6c6]">
                Próximo Evento
              </p>
              <h2 className={`${SYNE} text-[40px] md:text-[120px] font-extrabold text-[#e5e2e1] tracking-tighter leading-[1.1]`}>
                Festival de Jazz MVD
              </h2>
              <div className="flex flex-wrap items-center gap-4 mt-4">
                <span className="text-[18px] text-[#cfc4c5]">Teatro Solís</span>
                <span className="w-1 h-1 rounded-full bg-[#4c4546]" />
                <span className="text-[18px] text-[#cfc4c5]">20:00 hs</span>
                <span className="w-1 h-1 rounded-full bg-[#4c4546]" />
                <span className="text-[18px] text-[#cfc4c5]">Montaje de Escenario</span>
              </div>
            </div>
            <div className="col-span-1 md:col-span-4 flex flex-col items-start md:items-end mt-8 md:mt-0">
              <button className="bg-[#c6c6c6] text-[#303030] label-tech text-[12px] px-10 py-5 uppercase tracking-widest border border-[#c6c6c6] hover:bg-transparent hover:text-[#c6c6c6] transition-all duration-200">
                Editar Perfil
              </button>
            </div>
          </section>

          {/* Stats tipográficos */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-0 border-y border-[#4c4546]/20 py-16 my-8">
            <div className="flex flex-col gap-4 items-center justify-center border-b md:border-b-0 md:border-r border-[#1A1A1A] pb-12 md:pb-0">
              <span className={`${SYNE} text-[120px] font-extrabold text-[#c6c6c6] leading-none`}>
                42
              </span>
              <span className="label-tech text-[12px] uppercase text-[#cfc4c5] tracking-widest">
                Eventos Realizados
              </span>
            </div>
            <div className="flex flex-col gap-4 items-center justify-center pt-12 md:pt-0">
              <span className={`${SYNE} text-[120px] font-extrabold text-[#c6c6c6] leading-none`}>
                98<span className="text-[64px]">%</span>
              </span>
              <span className="label-tech text-[12px] uppercase text-[#cfc4c5] tracking-widest">
                Tasa de Asistencia
              </span>
            </div>
          </section>

          {/* Propuestas pendientes */}
          <section className="flex flex-col gap-6 mt-6">
            <div className="flex justify-between items-end border-b border-[#1A1A1A] pb-4">
              <h3 className={`${SYNE} text-[32px] md:text-[64px] font-bold text-[#e5e2e1] tracking-tight`}>
                Propuestas Pendientes
              </h3>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#c6c6c6]" />
                <span className="label-tech text-[12px] text-[#c6c6c6] uppercase tracking-widest">
                  3 Nuevas
                </span>
              </div>
            </div>
            <div className="flex flex-col">
              {proposals.map((p) => (
                <div
                  key={p.title}
                  className="group flex flex-col md:flex-row justify-between items-start md:items-center py-6 border-b border-[#1A1A1A] hover:border-[#c6c6c6] transition-colors cursor-pointer gap-4 md:gap-0"
                >
                  <div className="flex flex-col gap-1">
                    <span className="label-tech text-[12px] text-[#cfc4c5] uppercase">
                      {p.date}
                    </span>
                    <h4 className="text-[18px] font-semibold text-[#e5e2e1] group-hover:text-[#c6c6c6] transition-colors">
                      {p.title}
                    </h4>
                    <span className="text-[16px] text-[#cfc4c5]">
                      {p.role} • {p.hours}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <button className="label-tech text-[12px] uppercase tracking-widest text-[#F5F5F5] hover:text-[#c6c6c6] transition-colors border border-[#1A1A1A] px-4 py-2 hover:border-[#c6c6c6]">
                      Ver Detalles
                    </button>
                    <ArrowRight
                      size={22}
                      className="text-[#cfc4c5] group-hover:text-[#c6c6c6] transition-colors"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      {/* BottomNav mobile */}
      <nav className="md:hidden fixed bottom-0 w-full z-50 flex justify-around items-center px-4 pb-6 h-[80px] bg-[#20201f]/80 backdrop-blur-lg border-t border-[#1A1A1A]">
        {sideNav.map(({ icon: Icon, label }) => (
          <a
            key={label}
            href="#"
            className="flex flex-col items-center justify-center text-[#cfc4c5] hover:bg-white/5 p-2 rounded-lg transition-colors"
          >
            <Icon size={22} className="mb-1" />
            <span className="text-[10px]">{label}</span>
          </a>
        ))}
        <a
          href="#"
          className="flex flex-col items-center justify-center bg-[#000000] rounded-lg px-3 py-1 scale-90 duration-200"
        >
          <CalendarDays size={22} className="mb-1 text-[#c6c6c6]" />
          <span className="text-[10px] text-[#c6c6c6] font-bold">Eventos</span>
        </a>
      </nav>
    </div>
  );
}
