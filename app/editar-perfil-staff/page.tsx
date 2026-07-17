/**
 * Editar Perfil - Staff (porteo FIEL de "LABURO - Editor de Perfil Staff" de Stitch).
 * Pantalla STANDALONE del lado STAFF: trae su propio chrome (sidenav desktop de
 * 280px, top bar mobile y bottom nav mobile), NO el sidebar del portal de agencia.
 * Server component estático: los inputs son de solo lectura (readOnly con
 * defaultValue). Colores/fuentes exactos de Stitch en valores arbitrarios
 * (fondo #131313, sidenav #0e0e0e, superficies #1c1b1b/#20201f, texto #e5e2e1,
 * secundario #cfc4c5, primary #c6c6c6, bordes #1A1A1A). Iconos lucide-react en
 * reemplazo de Material Symbols. Copy traducido a voseo rioplatense.
 */

import {
  Search,
  Tag,
  Heart,
  Calendar,
  Settings,
  LogOut,
  Bell,
  UploadCloud,
} from "lucide-react";

const NAV_ITEMS = [
  { icon: Search, label: "Buscar" },
  { icon: Tag, label: "Ofertas" },
  { icon: Heart, label: "Favoritos" },
  { icon: Calendar, label: "Eventos" },
];

const MOBILE_NAV = [
  { icon: Search, label: "Buscar" },
  { icon: Tag, label: "Ofertas" },
  { icon: Heart, label: "Favoritos" },
  { icon: Calendar, label: "Eventos" },
];

export default function EditarPerfilStaffPage() {
  return (
    <div className="min-h-dvh bg-[#131313] text-[#e5e2e1] antialiased flex selection:bg-[#c6c6c6] selection:text-[#303030]">
      {/* Sidenav desktop */}
      <nav className="hidden md:flex flex-col bg-[#0e0e0e]/90 backdrop-blur-2xl fixed left-0 top-0 h-full w-[280px] border-r border-[#1A1A1A] shadow-2xl py-8 z-50">
        <div className="px-6 mb-12">
          <h1 className="font-[family-name:var(--font-syne)] text-[28px] font-bold text-[#c6c6c6] tracking-tighter leading-none">
            LABURO
          </h1>
          <p className="label-tech text-[12px] text-[#cfc4c5] mt-2 tracking-[0.2em]">
            Portal de Producción
          </p>
        </div>

        <div className="flex-1 flex flex-col gap-2">
          {NAV_ITEMS.map(({ icon: Icon, label }) => (
            <a
              key={label}
              href="#"
              className="flex items-center gap-3 px-6 py-4 text-[#cfc4c5] hover:bg-white/5 hover:text-[#c6c6c6] transition-all"
            >
              <Icon size={20} className="shrink-0" />
              <span className="label-tech text-[12px] tracking-[0.2em]">
                {label}
              </span>
            </a>
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-2">
          {/* Estado activo: Ajustes */}
          <a
            href="#"
            className="flex items-center gap-3 px-6 py-4 bg-white/5 border-l-4 border-[#c6c6c6] text-[#c6c6c6] translate-x-1 duration-200"
          >
            <Settings size={20} className="shrink-0" />
            <span className="label-tech text-[12px] tracking-[0.2em]">
              Ajustes
            </span>
          </a>
          <a
            href="#"
            className="flex items-center gap-3 px-6 py-4 text-[#cfc4c5] hover:bg-white/5 hover:text-[#c6c6c6] transition-all"
          >
            <LogOut size={20} className="shrink-0" />
            <span className="label-tech text-[12px] tracking-[0.2em]">
              Salir
            </span>
          </a>
        </div>
      </nav>

      {/* Lienzo principal */}
      <main className="w-full md:pl-[280px] flex flex-col min-h-dvh">
        {/* Top bar mobile */}
        <header className="md:hidden flex justify-between items-center px-6 py-4 w-full h-16 bg-[#131313]/80 backdrop-blur-xl fixed top-0 left-0 border-b border-[#1A1A1A] z-40">
          <h1 className="font-[family-name:var(--font-syne)] text-[32px] tracking-tighter text-[#c6c6c6] font-bold leading-none">
            LABURO
          </h1>
          <div className="flex gap-4">
            <Bell
              size={24}
              className="text-[#c6c6c6] cursor-pointer hover:text-[#e5e2e1] transition-colors"
            />
            <Settings
              size={24}
              className="text-[#c6c6c6] cursor-pointer hover:text-[#e5e2e1] transition-colors"
            />
          </div>
        </header>

        <div className="flex-1 max-w-[1000px] w-full mx-auto px-6 md:px-20 py-24 md:py-32">
          <header className="mb-[160px]">
            <h2 className="font-[family-name:var(--font-syne)] text-[40px] md:text-[64px] font-bold leading-[1.1] tracking-tight text-[#c6c6c6] mb-4">
              Editar Perfil
            </h2>
            <p className="text-[18px] leading-[1.6] text-[#cfc4c5] max-w-2xl">
              Puliendo tu presencia profesional. Asegurate de que todos los
              datos reflejen tu mejor nivel de experiencia dentro del ecosistema
              LABURO.
            </p>
          </header>

          <form className="grid grid-cols-1 gap-[160px]">
            {/* Grupo: Identidad */}
            <section className="grid grid-cols-1 md:grid-cols-12 gap-8">
              <div className="md:col-span-4">
                <h3 className="font-[family-name:var(--font-syne)] text-[32px] font-semibold leading-[1.2] tracking-tight text-[#e5e2e1] mb-2">
                  Identidad
                </h3>
                <p className="text-[16px] leading-[1.6] text-[#cfc4c5]">
                  Datos profesionales clave que se usan en todas las
                  producciones.
                </p>
              </div>

              <div className="md:col-span-8 flex flex-col gap-12">
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="name"
                    className="label-tech text-[12px] text-[#e5e2e1] tracking-[0.2em]"
                  >
                    Nombre completo
                  </label>
                  <input
                    readOnly
                    id="name"
                    name="name"
                    type="text"
                    defaultValue="María González"
                    placeholder="ej. María González"
                    className="w-full bg-transparent border-0 border-b border-[#1A1A1A] focus:border-[#c6c6c6] focus:ring-0 px-0 py-4 text-[18px] text-[#c6c6c6] placeholder:text-[#cfc4c5]/50 transition-colors focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="role"
                    className="label-tech text-[12px] text-[#e5e2e1] tracking-[0.2em]"
                  >
                    Rol principal
                  </label>
                  <input
                    readOnly
                    id="role"
                    name="role"
                    type="text"
                    defaultValue="Directora Creativa / Escenógrafa"
                    placeholder="ej. Directora Creativa / Escenógrafa"
                    className="w-full bg-transparent border-0 border-b border-[#1A1A1A] focus:border-[#c6c6c6] focus:ring-0 px-0 py-4 text-[18px] text-[#c6c6c6] placeholder:text-[#cfc4c5]/50 transition-colors focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="languages"
                    className="label-tech text-[12px] text-[#e5e2e1] tracking-[0.2em]"
                  >
                    Idiomas
                  </label>
                  <input
                    readOnly
                    id="languages"
                    name="languages"
                    type="text"
                    defaultValue="Español (Nativo), Inglés (Fluido)"
                    placeholder="ej. Español (Nativo), Inglés (Fluido)"
                    className="w-full bg-transparent border-0 border-b border-[#1A1A1A] focus:border-[#c6c6c6] focus:ring-0 px-0 py-4 text-[18px] text-[#c6c6c6] placeholder:text-[#cfc4c5]/50 transition-colors focus:outline-none"
                  />
                </div>
              </div>
            </section>

            {/* Dropzone monumental */}
            <section className="grid grid-cols-1 md:grid-cols-12 gap-8">
              <div className="md:col-span-4">
                <h3 className="font-[family-name:var(--font-syne)] text-[32px] font-semibold leading-[1.2] tracking-tight text-[#e5e2e1] mb-2">
                  Archivos
                </h3>
                <p className="text-[16px] leading-[1.6] text-[#cfc4c5]">
                  Subí tu Curriculum Vitae e imágenes de portfolio en alta
                  resolución. PDF, JPG, PNG.
                </p>
              </div>

              <div className="md:col-span-8">
                <div className="relative flex flex-col items-center justify-center min-h-[400px] border border-[#1A1A1A] bg-[#0e0e0e]/50 hover:bg-[#1c1b1b] transition-all duration-300 cursor-pointer group">
                  <div className="flex flex-col items-center text-center px-6">
                    <UploadCloud
                      size={48}
                      strokeWidth={1.5}
                      className="text-[#cfc4c5] mb-6 group-hover:text-[#c6c6c6] transition-colors"
                    />
                    <h4 className="font-[family-name:var(--font-syne)] text-[32px] font-semibold leading-[1.2] tracking-tight text-[#c6c6c6] mb-2">
                      Soltá tus archivos acá
                    </h4>
                    <p className="text-[16px] leading-[1.6] text-[#cfc4c5] max-w-sm">
                      o hacé clic para buscarlos. Tamaño máximo por archivo:
                      50MB.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Acciones */}
            <div className="flex justify-end gap-6 pt-12 border-t border-[#1A1A1A]">
              <button
                type="button"
                className="label-tech text-[12px] tracking-[0.2em] text-[#e5e2e1] hover:text-[#c6c6c6] px-8 py-4 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-[#F5F5F5] text-black label-tech text-[12px] tracking-[0.2em] px-12 py-4 border border-[#F5F5F5] hover:bg-transparent hover:text-[#F5F5F5] transition-all duration-150"
              >
                Guardar perfil
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-6 h-[80px] bg-[#20201f]/80 backdrop-blur-lg shadow-lg">
        {MOBILE_NAV.map(({ icon: Icon, label }) => (
          <a
            key={label}
            href="#"
            className="flex flex-col items-center justify-center text-[#cfc4c5] w-16 h-12"
          >
            <Icon size={22} className="mb-1" />
            <span className="label-tech text-[10px] tracking-[0.15em]">
              {label}
            </span>
          </a>
        ))}
      </nav>
    </div>
  );
}
