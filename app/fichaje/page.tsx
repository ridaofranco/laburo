/**
 * Fichaje operativo (porteo FIEL de "Fichaje Operativo - Mobile" de Stitch).
 * Pantalla STANDALONE del lado STAFF: la persona ficha entrada/salida por
 * geolocalización desde el teléfono. Es una persona distinta al productor, así
 * que reproduce SU PROPIO chrome (mapa de fondo, header de estado, botón gigante
 * de check-in, historial del día, bottom nav), NO el sidebar del portal.
 * Server component. Estilos exactos de Stitch en valores arbitrarios. Datos de
 * ejemplo estáticos. Copy en español rioplatense (voseo), sin guión largo.
 */

import {
  MapPin,
  Fingerprint,
  LogIn,
  LogOut,
  Bell,
  Settings,
  Search,
  Tag,
  Heart,
  CalendarDays,
} from "lucide-react";

const MAP_BG =
  "url('https://lh3.googleusercontent.com/aida-public/AB6AXuB8HWrkXBMxG3s5_Z4Vyjn_38w47TyNCVf4lla5r8Qk-AkOwwyZPDN7kMGoGv2ZXwjNwrEiPHCM1ZA4wIPNMkzahbLZ29WAie-ctpuuTujt5rMNVYtEh8W35jgKyPNQqpdfv3wpFR0S3p3wUjkOptzhqZF61Tf26DspJgxH96OodBVQb2YzT5Q8GnDptiW-MkOzsYMIiT7zcae9TJXkzfN7HDA2eJyWdnwYkDZBe2YA1bcEFN_PTDwc3Nh6OwWUVvyDayEa05UQduI')";

export default function FichajePage() {
  return (
    <div className="min-h-dvh bg-black text-[#e5e2e1] flex justify-center antialiased">
      {/* Animación de pulso del botón de fichaje (fiel a Stitch .pulse-ring) */}
      <style>{`
        @keyframes laburo-pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(198,198,198,0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 20px rgba(198,198,198,0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(198,198,198,0); }
        }
        .laburo-pulse-ring { animation: laburo-pulse 2s infinite cubic-bezier(0.66,0,0,1); }
      `}</style>

      {/* Contenedor mobile (standalone, chrome propio) */}
      <div className="relative w-full max-w-[440px] min-h-dvh bg-[#131313] overflow-hidden flex flex-col">
        {/* Top nav (oculto en mobile, visible en pantallas grandes tal cual Stitch) */}
        <nav className="hidden md:flex justify-between items-center px-6 py-4 w-full h-16 bg-[#131313]/80 backdrop-blur-xl border-b border-[#4c4546] fixed top-0 z-50">
          <div className="font-[family-name:var(--font-syne)] text-[24px] font-extrabold tracking-tighter text-[#c6c6c6]">
            LABURO
          </div>
          <div className="flex gap-4">
            <span className="text-[#cfc4c5] hover:bg-[#20201f] transition-colors cursor-pointer p-2 rounded-full">
              <Bell size={20} />
            </span>
            <span className="text-[#cfc4c5] hover:bg-[#20201f] transition-colors cursor-pointer p-2 rounded-full">
              <Settings size={20} />
            </span>
          </div>
        </nav>

        {/* Mapa de fondo */}
        <div
          className="absolute inset-0 z-0 grayscale opacity-40 mix-blend-screen bg-cover bg-center"
          style={{ backgroundImage: MAP_BG }}
          aria-hidden="true"
        />

        {/* Contenido principal */}
        <main className="relative z-10 flex-1 flex flex-col h-full md:pt-16 pb-[80px]">
          {/* Header / Estado */}
          <header className="px-6 pt-12 pb-6 flex flex-col items-center justify-center text-center">
            <h1 className="font-[family-name:var(--font-syne)] text-[40px] font-bold leading-[1.1] tracking-tighter text-[#c6c6c6] mb-2">
              08:45
            </h1>
            <p className="label-tech text-[12px] text-[#cfc4c5] uppercase tracking-widest">
              Jueves, 24 de Octubre
            </p>
            <div className="mt-6 flex items-center gap-2 bg-[#2a2a2a]/50 border border-[#353535] rounded-full px-4 py-2 backdrop-blur-md">
              <MapPin size={16} className="text-[#c6c6c6]" fill="currentColor" />
              <span className="label-tech text-[12px] text-[#c6c6c6]">
                Estás en el lugar correcto
              </span>
            </div>
            <p className="text-[16px] text-[#cfc4c5] mt-2">Estadio Monumental</p>
          </header>

          {/* Botón gigante de fichaje */}
          <section className="flex-1 flex items-center justify-center px-6">
            <button
              type="button"
              className="laburo-pulse-ring relative group w-64 h-64 rounded-full bg-[#c6c6c6] text-black font-[family-name:var(--font-syne)] text-[32px] font-semibold tracking-tight flex items-center justify-center shadow-2xl transition-transform duration-150 active:scale-95 focus:outline-none"
            >
              <span className="relative z-10 flex flex-col items-center">
                <Fingerprint size={48} className="mb-2" strokeWidth={1.5} />
                FICHAR
              </span>
              <div className="absolute inset-0 rounded-full border border-[#c6c6c6]/20 scale-110 group-hover:scale-125 transition-transform duration-500 ease-out" />
              <div className="absolute inset-0 rounded-full border border-[#c6c6c6]/10 scale-125 group-hover:scale-150 transition-transform duration-700 ease-out" />
            </button>
          </section>

          {/* Historial de hoy */}
          <section className="px-6 pb-12">
            <div className="border-t border-[#353535] pt-2">
              <h2 className="label-tech text-[12px] text-[#cfc4c5] uppercase tracking-widest mb-2">
                Historial de hoy
              </h2>
              <ul className="space-y-0">
                <li className="flex justify-between items-center py-4 border-b border-[#2a2a2a]/50">
                  <div className="flex items-center gap-3">
                    <LogIn size={20} className="text-[#c6c6c7]/50" />
                    <span className="text-[16px] text-[#e5e2e1]">Entrada</span>
                  </div>
                  <span className="label-tech text-[12px] text-[#c6c6c6]">--:--</span>
                </li>
                <li className="flex justify-between items-center py-4 opacity-50">
                  <div className="flex items-center gap-3">
                    <LogOut size={20} className="text-[#c6c6c7]/50" />
                    <span className="text-[16px] text-[#e5e2e1]">Salida</span>
                  </div>
                  <span className="label-tech text-[12px] text-[#cfc4c5]">--:--</span>
                </li>
              </ul>
            </div>
          </section>
        </main>

        {/* Bottom nav (mobile) */}
        <nav className="absolute bottom-0 w-full z-50 flex justify-around items-center px-4 pb-6 h-20 bg-[#20201f]/80 backdrop-blur-lg border border-[#4c4546] shadow-lg rounded-t-xl md:hidden">
          <a
            href="#"
            className="flex flex-col items-center justify-center text-[#cfc4c5] hover:bg-[#20201f] p-2 rounded-lg transition-colors"
          >
            <Search size={22} className="mb-1" />
            <span className="label-tech text-[12px]">Buscar</span>
          </a>
          <a
            href="#"
            className="flex flex-col items-center justify-center text-[#cfc4c5] hover:bg-[#20201f] p-2 rounded-lg transition-colors"
          >
            <Tag size={22} className="mb-1" />
            <span className="label-tech text-[12px]">Ofertas</span>
          </a>
          <a
            href="#"
            className="flex flex-col items-center justify-center text-[#cfc4c5] hover:bg-[#20201f] p-2 rounded-lg transition-colors"
          >
            <Heart size={22} className="mb-1" />
            <span className="label-tech text-[12px]">Favoritos</span>
          </a>
          {/* Estado activo: Eventos (trabajando en un evento) */}
          <a
            href="#"
            className="flex flex-col items-center justify-center bg-black text-[#757575] rounded-lg px-4 py-2 scale-90 duration-200"
          >
            <CalendarDays size={22} className="mb-1" fill="currentColor" />
            <span className="label-tech text-[12px] font-bold">Eventos</span>
          </a>
        </nav>
      </div>
    </div>
  );
}
