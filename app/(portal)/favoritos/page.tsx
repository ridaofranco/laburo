/**
 * Mis Favoritos (porteo FIEL de "Mis Favoritos - Minimalista Radical" de
 * Stitch). Lista de perfiles guardados como favoritos: avatar en grayscale que
 * se colorea al hover, nombre (Syne), rol/tarifa/disponibilidad (Geist) y
 * acciones "VER PERFIL" + eliminar. Estilos exactos de Stitch en valores
 * arbitrarios. Copy tal cual (español, se ajusta después). Contenido de ejemplo
 * estático: el layout del portal ya pone el sidebar y el <main md:pl-[280px]>.
 */

import { ListFilter, X } from "lucide-react";

interface Favorito {
  nombre: string;
  rol: string;
  tarifa: string;
  disponibilidad: string;
  img: string;
  alt: string;
}

const FAVORITOS: Favorito[] = [
  {
    nombre: "ELENA M.",
    rol: "DIRECTORA DE ARTE",
    tarifa: "$$$",
    disponibilidad: "INMEDIATA",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCLC1Ca7YdvzBFYbK9SrBBGag7502RAsEVtCji4-Di6KLP8ppaTjke5IM8xdSZbqhfxj8iGGm35VYyCOBfsE6-KnxwReTrUoGjhLtywnvy4UMxucsWxqN9SlU9CxyZQNXrBGlayC-RdauGeXGXxKQ-lGTBqyvDTQdpt-H_IcfDN0yCCTuLx1kVk4TZiWI6-yx3WcSGm2lI6kqG3yjz1OH3Fsiq176E6rsNCIA7IBCdEe8s8zTiwUap-K8iulpoRaBaLykTE_QIHBqs",
    alt: "A stark, high-contrast black and white portrait of a professional lighting technician looking slightly off-camera. The lighting is dramatic, emphasizing structural facial features. The background is pure darkness. The aesthetic is extremely minimalist and corporate, fitting a high-end agency portfolio.",
  },
  {
    nombre: "MARCUS T.",
    rol: "INGENIERO DE SONIDO",
    tarifa: "$$",
    disponibilidad: "1 SEMANA",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDDK1tFIPD0oBZW9oi02KfHsd1XtAduk6FmvIm2aCV33JtHGo0uCouYqYv_hxOVXU1SrMZXSYk7TC-2IJeWSsVxDTAqgqAHwtOdQnGbLpjtibi-Ye-H8BrDlK_rZW-zQ3GhStp90-65cnvaBPLIl2Wdh15XC3yhzjGBoKRw5WJLwohneoQsoMJ5TcoePPYBVgYPu9Z1WLQe_u_7TP1KdDpcb3Xt3n3Q88MisRReo04-vq88AkNJWJq9cP9RW6v2z6ZyGrq2eNkQwYI",
    alt: "A moody, high-contrast monochrome photograph of a young sound engineer wearing professional headphones around his neck. He is looking directly at the camera with a neutral, serious expression. The lighting is extremely structured, creating a minimalist, ultra-premium gallery feel against a deep black background.",
  },
  {
    nombre: "DAVID R.",
    rol: "PRODUCTOR EJECUTIVO",
    tarifa: "$$$$",
    disponibilidad: "OCTUBRE",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuB69rShPUUqf901jRczdXpLyn21A1pQ0HNrSwMi63Yfc7kDC8cYeTHPqqwldJsmBcv_RRAzlXXizOhebxW9Iikm0evEPBSxO3qZPlVOq2e09VAbmuD447box3uu5NtJEnWB7_zbVTS41N-gfs3dCvZKiQ1_s6HVFNENvIftzS7SCVmop4sKyDKaA5mMFbZPFdWvJfCczgGzcKXEDeuTs-1AI5ukxFBQmSaMlgxEzXkz8PY5_WDLJfOgm_KF_2h5K_uQmXLDY90Rv2o",
    alt: "A striking black and white headshot of an older, experienced event producer with a very clean, structural composition. The framing is tight on his face, showing character lines. The lighting is bright and directional from the left, plunging the right side into deep shadow. Minimalist, premium aesthetic.",
  },
];

export default function FavoritosPage() {
  const registros = String(FAVORITOS.length).padStart(2, "0");

  return (
    <div className="max-w-[1440px] mx-auto w-full px-6 md:px-20 py-16 md:py-24">
      {/* Header */}
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#4c4546] pb-8">
        <h1 className="font-[family-name:var(--font-syne)] text-[40px] md:text-[120px] font-extrabold leading-[1.1] tracking-[-0.04em] uppercase text-[#e5e2e1]">
          FAVORITOS
        </h1>
        <div className="flex items-center gap-4 text-[#cfc4c5] label-tech text-[12px]">
          <span>{registros} REGISTROS</span>
          <ListFilter size={18} />
        </div>
      </header>

      {/* List */}
      <div className="flex flex-col">
        {FAVORITOS.map((f) => (
          <div
            key={f.nombre}
            className="group flex flex-col md:flex-row md:items-center justify-between py-6 border-b border-[#4c4546] hover:border-b-[#e5e2e1] transition-colors duration-300 gap-6"
          >
            {/* Perfil */}
            <div className="flex items-center gap-8">
              <div className="w-16 h-16 md:w-24 md:h-24 bg-[#20201f] shrink-0 grayscale group-hover:grayscale-0 transition-all duration-500 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="w-full h-full object-cover"
                  src={f.img}
                  alt={f.alt}
                />
              </div>
              <div className="flex flex-col">
                <h2 className="font-[family-name:var(--font-syne)] text-[32px] font-semibold leading-[1.2] tracking-[-0.01em] uppercase text-[#e5e2e1]">
                  {f.nombre}
                </h2>
                <p className="label-tech text-[12px] text-[#cfc4c5] mt-2">
                  {f.rol}
                </p>
              </div>
            </div>

            {/* Meta + acciones */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8 label-tech text-[12px]">
              <div className="text-[#cfc4c5]">
                <span className="block mb-1 opacity-50">TARIFA</span>
                <span>{f.tarifa}</span>
              </div>
              <div className="text-[#cfc4c5]">
                <span className="block mb-1 opacity-50">DISP.</span>
                <span>{f.disponibilidad}</span>
              </div>
              <div className="flex items-center gap-4 mt-4 md:mt-0">
                <button
                  type="button"
                  className="bg-[#e5e2e1] text-[#131313] border border-transparent hover:bg-transparent hover:text-[#e5e2e1] hover:border-[#e5e2e1] transition-all duration-150 label-tech text-[12px] px-6 py-3 tracking-[0.1em]"
                >
                  VER PERFIL
                </button>
                <button
                  type="button"
                  aria-label="Eliminar"
                  className="text-[#4c4546] hover:text-[#ffb4ab] transition-colors duration-150 p-2"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
