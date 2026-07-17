"use client";

/**
 * Visor de CV híbrido (PERF-02 + Claude's Discretion).
 *
 * - bucket: "Ver CV" pide la signed URL (60s) a la server action signCv y
 *   embebe el PDF; "Abrir CV" abre una URL recién firmada en pestaña nueva.
 * - drive: iframe /preview OPTIMISTA (sólo renderiza si el archivo es público)
 *   + SIEMPRE el escape hatch "Abrir CV" en pestaña nueva, que usa la sesión
 *   de Google de Franco (Pitfall 5).
 * - none / link muerto: estado dead-link del UI-SPEC, nunca un crash.
 *
 * Este componente importa la server ACTION (cv-actions), jamás admin.ts:
 * la service-role key no llega al cliente (T-02-15).
 */

import { useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import type { CvClassification } from "@/lib/cv";
import { signCv } from "./cv-actions";

type ViewState = "idle" | "loading" | "embedded" | "dead";

/** Estado dead-link (copy exacta del UI-SPEC). */
function DeadCv({ onOpen }: { onOpen?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-sm rounded-2xl bg-surface-1 border border-border p-md">
      <p className="text-body text-fg">No pudimos abrir este CV.</p>
      <p className="text-label font-normal text-fg-muted">
        Probá abrirlo en una pestaña nueva.
      </p>
      {onOpen && (
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-xs min-h-[44px] rounded-xl bg-surface-2 border border-border text-fg text-label font-semibold px-md transition-transform active:scale-[0.98]"
        >
          <ExternalLink size={16} aria-hidden="true" />
          Abrir CV
        </button>
      )}
    </div>
  );
}

function AbrirCvButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-xs min-h-[44px] rounded-xl bg-surface-2 border border-border text-fg text-label font-semibold px-md transition-transform active:scale-[0.98]"
    >
      <ExternalLink size={16} aria-hidden="true" />
      Abrir CV
    </button>
  );
}

/** CV de bucket propio: firmar on-demand y embeber; re-firmar para abrir. */
function BucketCv({ objectKey }: { objectKey: string }) {
  const [state, setState] = useState<ViewState>("idle");
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  const ver = async () => {
    setState("loading");
    try {
      const url = await signCv(objectKey);
      if (url) {
        setSignedUrl(url);
        setState("embedded");
      } else {
        setState("dead");
      }
    } catch {
      setState("dead");
    }
  };

  // Abrir en pestaña nueva: abrir la ventana SINCRONO (evita popup-block) y
  // navegarla cuando llega la URL recién firmada (la TTL de 60s exige firmar
  // de nuevo, no reusar una URL vieja).
  const abrir = async () => {
    const win = window.open("about:blank", "_blank");
    // WR-04: cortar window.opener antes de navegar a un CV subido por el
    // postulante (podria ser HTML malicioso que secuestre la pestaña de LABURO).
    if (win) win.opener = null;
    try {
      const url = await signCv(objectKey);
      if (url && win) {
        win.location.href = url;
      } else {
        win?.close();
        setState("dead");
      }
    } catch {
      win?.close();
      setState("dead");
    }
  };

  if (state === "dead") return <DeadCv onOpen={abrir} />;

  return (
    <div className="flex flex-col gap-sm">
      {state === "embedded" && signedUrl ? (
        <iframe
          src={signedUrl}
          title="CV del candidato"
          className="w-full h-[60vh] rounded-2xl border border-border bg-surface-1"
          onError={() => setState("dead")}
        />
      ) : state === "loading" ? (
        <div className="grid place-items-center h-[120px] rounded-2xl border border-border bg-surface-1 text-fg-muted text-label font-normal">
          Cargando CV…
        </div>
      ) : null}
      <div className="flex items-center gap-sm">
        {state !== "embedded" && (
          <button
            type="button"
            onClick={ver}
            disabled={state === "loading"}
            className="inline-flex items-center justify-center gap-xs min-h-[44px] rounded-none bg-fg text-surface-0 border border-fg label-tech text-[13px] px-md transition-colors hover:bg-transparent hover:text-fg disabled:opacity-60"
          >
            <FileText size={16} aria-hidden="true" />
            Ver CV
          </button>
        )}
        <AbrirCvButton onClick={abrir} />
      </div>
    </div>
  );
}

/** CV de Google Drive: /preview optimista + escape hatch SIEMPRE visible. */
function DriveCv({ preview, open }: { preview: string; open: string }) {
  const [dead, setDead] = useState(false);

  const abrir = () => {
    window.open(open, "_blank", "noopener,noreferrer");
  };

  if (dead) return <DeadCv onOpen={abrir} />;

  return (
    <div className="flex flex-col gap-sm">
      <iframe
        src={preview}
        title="CV del candidato"
        className="w-full h-[60vh] rounded-2xl border border-border bg-surface-1"
        allow="autoplay"
        onError={() => setDead(true)}
      />
      <div>
        <AbrirCvButton onClick={abrir} />
      </div>
    </div>
  );
}

/** Punto de entrada: rutea por la clasificación de lib/cv.ts. */
export function CvView({ classification }: { classification: CvClassification }) {
  if (classification.kind === "none") {
    return <DeadCv />;
  }
  if (classification.kind === "drive") {
    return <DriveCv preview={classification.preview} open={classification.open} />;
  }
  return <BucketCv objectKey={classification.key} />;
}
