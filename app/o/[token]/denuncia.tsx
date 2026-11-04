"use client";

import { DenunciarOferta } from "@/components/denunciar-oferta";
import { denunciarOfertaPorToken } from "./offer-actions";

/** «Denunciar esta oferta» en la oferta por link: identifica la oferta por el token. */
export function DenunciaPorToken({ token }: { token: string }) {
  return (
    <DenunciarOferta
      color="text-fg-muted hover:text-fg"
      className="self-center"
      onDenunciar={(m, d) => denunciarOfertaPorToken(token, m, d)}
    />
  );
}
