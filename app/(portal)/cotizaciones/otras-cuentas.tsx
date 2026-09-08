"use client";

/**
 * "Los tenés en la otra productora." El aviso que reemplaza a la pantalla vacía.
 *
 * ── EL PROBLEMA QUE RESUELVE ────────────────────────────────────────────────
 * El portal trabaja con UNA organización por vez. Con el selector puesto en la
 * otra, /cotizaciones dice "todavía no pediste ningún precio" teniendo doce
 * pedidos a un click. Eso no se lee como "estás mirando la otra cuenta": se lee
 * como que la app perdió los datos.
 *
 * ⚠️ Cambiar de productora es una acción, no un link: mueve la cookie de
 * contexto y revalida el layout entero. Por eso esto es cliente y llama a
 * `elegirOrg`, que es la única puerta para eso. Un `<Link>` a otra ruta dejaría
 * la cookie donde estaba y no cambiaría nada.
 */

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { elegirOrg } from "../org-actions";
import type { PedidosEnOtraCuenta } from "./actions";

export function OtrasCuentas({ cuentas }: { cuentas: PedidosEnOtraCuenta[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (cuentas.length === 0) return null;

  function cambiar(orgId: string) {
    startTransition(async () => {
      const r = await elegirOrg(orgId);
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo cambiar de productora.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="border-l-2 border-[#e3c77f] pl-5 flex flex-col gap-3">
      <p className="text-[15px] text-[#cfc4c5] leading-[1.6]">
        {cuentas.length === 1
          ? "Ojo, no están perdidos: los tenés en tu otra productora."
          : "Ojo, no están perdidos: los tenés en tus otras productoras."}
      </p>
      <div className="flex flex-wrap gap-3">
        {cuentas.map((c) => (
          <button
            key={c.organizationId}
            type="button"
            onClick={() => cambiar(c.organizationId)}
            disabled={pending}
            className="min-h-[44px] px-5 border border-[#2a2a2a] text-[14px] text-[#cfc4c5] hover:border-[#e5e2e1] hover:text-[#e5e2e1] transition-colors disabled:opacity-50"
          >
            {c.pedidos} {c.pedidos === 1 ? "pedido" : "pedidos"} en {c.nombre}
          </button>
        ))}
      </div>
    </div>
  );
}
