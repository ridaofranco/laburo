/**
 * Onboarding del STAFF (porteo FIEL de "Onboarding Staff - LABURO" de Stitch).
 * Standalone: su propio chrome (wordmark arriba, controles abajo), NO el sidebar
 * del portal. Carrusel de 3 slides con indicadores y botón Siguiente/Comenzar.
 *
 * Client component porque el carrusel necesita estado (slide activo, avance).
 * Estilos exactos de Stitch en valores arbitrarios, radio 0 (sistema LABURO).
 * Copy traducido a voseo rioplatense, sin guión largo. Datos estáticos.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPen, Images, Tag, ArrowRight, Check } from "lucide-react";

interface Slide {
  id: number;
  Icon: typeof UserPen;
  image: string;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    id: 1,
    Icon: UserPen,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuB5XJjUSs6wNCvnm2SduEoL4VLecISJey2l0BvWRxcpzieDw21iSPqo-ut8KBnfWlk3UqGJByfEMg9K9OXu21OOlYaejofy77Nu3dW-wjvlwUxo5jxtOUCC8uzj_iP_zefacbEW7UaExt5zgwRHoU-YaZl5w1abgb2KznbnIj1sSBxpc-ZQFOGrh-57zRzYyQPfKkkCsBWCH7aM776mIl4MGYeMRvstjT2n9aHFsSOeFuLCZqB8e7CDXoko1-I9_H_0T60rCyb07N4",
    title: "Completá tu perfil",
    body: "Definí tu especialidad y experiencia. Un perfil detallado es tu mejor carta de presentación en la industria.",
  },
  {
    id: 2,
    Icon: Images,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBcOybnLEtQ3J1sKLCIdqml7SIgmrE7QrFdWlulVlhAmbZs4Czl5DVwM5Q80ph8dBTI4pc4lxfRTXECCjVjty4B6a6Q6nbuf2Ik6mSdTUxvVIlsJbJzHDF9zXZ5JQoxrX3n425OrVL4O0rXSgedYgKKbx7yEuIjo3Mw0K1wV4glK7uFPeVljAbYxGUxkNgJxGSTwT8D1iW9i8weZai8I25oNyxdgb7Qpso3gMPlsLfbuc0MIsdzn0XRtQ2ZehDupzOQYvPTHduetgg",
    title: "Subí tus mejores fotos",
    body: "Mostrá tu trabajo. Las imágenes hablan de tu calidad y atención al detalle. Construí tu portafolio.",
  },
  {
    id: 3,
    Icon: Tag,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuALMmY7UlUxtVhdPjre3AwrTVTtEhBsHqf9QFwSbWvVg0_1qD4GLBxaYH_avCznzzDIcwxlLyMhNdUW6gNyykdfL6bLapy-FNJWHBYslVvNH4pAGqZQKBq7CoxP6B_HOLL4ugD0b2wG3d0xlRkeOfnMP44ATC3RMt5r6EC6LKF4-BHzdisbX5L1VaEfAYK__5j6slh4cGQWBNH-qK0Lwp9R2ShWJTILC3ojMaI8d5eNpMvW7SfJxBNBqIbtkLDdRGkfXsOuNuN8GEo",
    title: "Recibí ofertas",
    body: "Conectate con producciones y clientes que buscan tu talento. Empezá a trabajar.",
  },
];

export default function OnboardingStaffPage() {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const isLast = current === SLIDES.length - 1;

  const handleNext = () => {
    if (!isLast) {
      setCurrent((c) => c + 1);
      return;
    }
    // Última slide: al panel del staff (si no está logueado, el gate lo manda a /acceso-staff).
    router.push("/panel-staff");
  };

  return (
    <div className="min-h-dvh bg-black text-[#e5e2e1] flex flex-col items-center justify-center overflow-hidden relative">
      {/* TopNav minimalista */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-center py-6">
        <h1 className="font-[family-name:var(--font-syne)] text-[32px] font-semibold tracking-tight text-[#e5e2e1]">
          LABURO
        </h1>
      </header>

      {/* Slides */}
      <main className="w-full max-w-[1440px] px-6 md:px-20 flex-grow flex items-center justify-center relative">
        {SLIDES.map((slide, index) => {
          const active = index === current;
          return (
            <section
              key={slide.id}
              aria-hidden={!active}
              className={`${
                active ? "flex opacity-100" : "hidden opacity-0"
              } flex-col items-center text-center w-full max-w-4xl transition-opacity duration-500 ease-in-out`}
            >
              <div className="mb-12 relative w-full h-[409px] border border-[#1A1A1A] overflow-hidden bg-[#0e0e0e]">
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-60 mix-blend-luminosity"
                  style={{ backgroundImage: `url('${slide.image}')` }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <slide.Icon
                    className="w-[120px] h-[120px] text-[#e5e2e1]"
                    strokeWidth={1}
                  />
                </div>
              </div>
              <h2 className="font-[family-name:var(--font-syne)] text-[40px] md:text-[64px] font-bold leading-[1.1] tracking-tight mb-6 text-[#e5e2e1]">
                {slide.title}
              </h2>
              <p className="text-[16px] md:text-[18px] leading-[1.6] text-[#cfc4c5] max-w-2xl mx-auto">
                {slide.body}
              </p>
            </section>
          );
        })}
      </main>

      {/* Controles inferiores */}
      <footer className="fixed bottom-0 left-0 w-full p-6 md:p-20 flex justify-between items-center z-50">
        <div className="flex gap-2">
          {SLIDES.map((slide, index) => (
            <div
              key={slide.id}
              className={`w-12 h-[2px] transition-all duration-300 ${
                index === current ? "bg-[#e5e2e1]" : "bg-[#353535]"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={handleNext}
          className="group relative px-8 py-4 bg-[#F5F5F5] text-black border border-transparent hover:bg-transparent hover:text-[#F5F5F5] hover:border-[#F5F5F5] transition-all duration-150 label-tech text-[12px] tracking-widest flex items-center gap-2"
        >
          {isLast ? (
            <>
              Comenzar
              <Check size={16} />
            </>
          ) : (
            <>
              Siguiente
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </footer>
    </div>
  );
}
