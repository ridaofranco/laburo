"use client";

/**
 * EL SELECTOR DE CONTEXTO: en nombre de quién estás actuando.
 *
 * Va en la barra lateral, en el lugar donde antes solo estaba el nombre de la
 * productora. Es el mismo lugar contestando la misma pregunta ("¿de quién es
 * este panel?"), ahora también en modo escritura.
 *
 * ⚠️ **CON UNA SOLA ORGANIZACIÓN NO SE DIBUJA NADA**, y no está roto: un
 * selector de una opción es ruido, ocupa lugar y sugiere que hay una decisión
 * que tomar cuando no la hay. En ese caso se muestra el nombre pelado, igual que
 * antes. El día que alguien tenga dos membresías, el selector aparece solo.
 *
 * ⚠️ Lo que se elige acá viaja a la base: cambiar de organización cambia a
 * dónde van las escrituras, no solo lo que dice la pantalla.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { elegirOrg } from "./org-actions";

export interface OrgOpcion {
  id: string;
  nombre: string;
}

export function OrgSelector({
  orgs,
  actualId,
  bajada,
}: {
  orgs: OrgOpcion[];
  actualId: string | null;
  /** Lo que se muestra cuando NO hay nada que elegir. */
  bajada: string;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [valor, setValor] = useState<string>(actualId ?? "");

  // Una sola organización (o ninguna): el nombre pelado, sin selector.
  if (orgs.length < 2) {
    return <p className="label-tech text-[12px] text-[#cfc4c5] mt-2">{bajada}</p>;
  }

  const cambiar = (id: string | null) => {
    if (!id || id === valor) return;
    const previo = valor;
    setValor(id);
    startTransition(async () => {
      const r = await elegirOrg(id);
      // Si la base dijo que no, se vuelve a lo que estaba: la pantalla no puede
      // quedar diciendo una organización distinta de la que se va a escribir.
      if (!r.ok) setValor(previo);
      else router.refresh();
    });
  };

  return (
    <Select.Root value={valor} onValueChange={cambiar} disabled={pendiente}>
      <Select.Trigger
        aria-label="Elegir productora"
        className="mt-2 flex items-center justify-between gap-2 w-full min-h-[44px] px-2 -ml-2 text-left text-[#cfc4c5] hover:text-[#e5e2e1] transition-colors outline-none focus-visible:ring-[2px] focus-visible:ring-[#e5e2e1]/45 disabled:opacity-60"
      >
        <Select.Value>
          {(v: string) => (
            <span className="label-tech text-[12px] truncate">
              {orgs.find((o) => o.id === v)?.nombre ?? bajada}
            </span>
          )}
        </Select.Value>
        <ChevronDown size={16} aria-hidden="true" className="shrink-0" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={6} alignItemWithTrigger={false} className="z-[80]">
          <Select.Popup className="min-w-[240px] max-h-[50vh] overflow-y-auto bg-[#20201f] border border-[#1c1b1b] shadow-2xl p-1 outline-none">
            {orgs.map((o) => (
              <Select.Item
                key={o.id}
                value={o.id}
                className="flex items-center justify-between gap-3 min-h-[44px] px-3 label-tech text-[12px] text-[#cfc4c5] cursor-pointer outline-none data-[highlighted]:bg-[#1c1b1b] data-[highlighted]:text-[#e5e2e1]"
              >
                <Select.ItemText>{o.nombre}</Select.ItemText>
                <Select.ItemIndicator>
                  <Check size={16} className="text-[#e5e2e1]" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
