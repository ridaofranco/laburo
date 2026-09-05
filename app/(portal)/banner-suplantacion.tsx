"use client";

/**
 * EL BANNER DE SUPLANTACIÓN. Invariante 4 de la 0073: mientras dure, tiene que
 * verse, en todas las pantallas, sin poder cerrarse.
 *
 * ── LAS CUATRO DECISIONES DE DISEÑO, Y POR QUÉ ──────────────────────────────
 *
 * 1. **Arriba de todo, sobre el `<main>`, no en la barra lateral.** En el
 *    teléfono la barra lateral no existe, así que un banner ahí sería invisible
 *    justo en el dispositivo desde el que más se opera.
 * 2. **Ámbar, que corta contra el gris de todo el portal.** Es un estado
 *    excepcional y tiene que parecerlo. Si se pareciera al resto, en diez
 *    minutos deja de leerse.
 * 3. **No se puede cerrar ni descartar.** Se sale saliendo. Un banner con "X"
 *    termina cerrado y la persona operando la cuenta de otro sin saberlo.
 * 4. **No es `fixed`.** Empuja el contenido hacia abajo en vez de taparlo: el
 *    `<main>` del portal ya tiene `pb-32` por el bottom-nav del teléfono, y un
 *    banner flotante arriba se superpondría con el contenido de cada pantalla.
 *    Que ocupe lugar es correcto: el estado ocupa lugar.
 */

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { salirDeSuplantacion } from "./suplantacion-actions";

export function BannerSuplantacion({ nombre }: { nombre: string | null }) {
  const router = useRouter();
  const [saliendo, startTransition] = useTransition();

  const salir = () => {
    startTransition(async () => {
      await salirDeSuplantacion();
      router.refresh();
    });
  };

  return (
    <div
      role="status"
      className="w-full bg-[#7a4a00] text-[#ffe9c7] border-b border-[#a86a00]"
    >
      <div className="flex flex-wrap items-center gap-3 px-6 md:px-10 py-3">
        <ShieldAlert size={18} className="shrink-0" aria-hidden="true" />
        <p className="text-[14px] leading-[1.5] flex-1 min-w-[200px]">
          Estás operando como{" "}
          <strong className="font-semibold text-[#fff6e8]">
            {nombre?.trim() || "otra productora"}
          </strong>
          . Todo lo que hagas queda registrado.
        </p>
        <button
          type="button"
          onClick={salir}
          disabled={saliendo}
          className="shrink-0 min-h-[44px] px-4 label-tech text-[12px] uppercase tracking-widest bg-[#ffe9c7] text-[#7a4a00] border border-[#ffe9c7] transition-colors hover:bg-transparent hover:text-[#ffe9c7] disabled:opacity-60"
        >
          {saliendo ? "Saliendo…" : "Salir"}
        </button>
      </div>
    </div>
  );
}
