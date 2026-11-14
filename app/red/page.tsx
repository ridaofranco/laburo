/**
 * Página de los links del mail de invitación a la red de proveedores y salones.
 * ?t=<baja_token>&a=baja|precios muestra UN botón; el cambio va por POST.
 */

import { LaburoWordmark } from "@/components/laburo-wordmark";
import { accionRed } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tu perfil en la red · LABURO", robots: { index: false, follow: false } };

const TEXTOS = {
  baja: {
    titulo: "¿Sacamos tu perfil de LABURO?",
    cuerpo: "Tu perfil deja de verse en el momento y no te volvemos a escribir por esto.",
    boton: "Sí, no quiero aparecer",
  },
  precios: {
    titulo: "¿Publicamos tus precios de referencia?",
    cuerpo: "Las productoras van a ver tus precios como referencia en tu perfil. Los podés cambiar o sacar cuando quieras desde tu panel.",
    boton: "Sí, publiquen mis precios",
  },
} as const;

const FINALES: Record<string, { titulo: string; cuerpo: string }> = {
  "baja-ok": { titulo: "Listo, ya no aparecés", cuerpo: "Sacamos tu perfil y no te vamos a escribir más por esto. Si algún día querés volver, respondé el mail que te mandamos." },
  "precios-ok": { titulo: "Listo, gracias", cuerpo: "Tus precios de referencia van a aparecer en tu perfil. Los podés cambiar cuando quieras desde tu panel." },
  invalido: { titulo: "Este link no funciona", cuerpo: "Puede que esté incompleto o que ya lo hayas usado. Respondé el mail que te mandamos y lo resolvemos." },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-surface-0">
      <header className="px-md py-md pt-[max(var(--spacing-md),env(safe-area-inset-top))]">
        <LaburoWordmark className="h-[24px] w-auto" />
      </header>
      <main className="flex-1 w-full max-w-[440px] mx-auto px-md pb-[max(var(--spacing-2xl),env(safe-area-inset-bottom))]">
        <div className="flex flex-col gap-md bg-surface-1 border border-border p-lg mt-xl">{children}</div>
      </main>
    </div>
  );
}

export default async function RedPage({ searchParams }: { searchParams: Promise<{ t?: string; a?: string; estado?: string }> }) {
  const { t = "", a = "", estado } = await searchParams;
  const final = estado ? FINALES[estado] ?? FINALES.invalido : !/^[a-f0-9]{32}$/.test(t) || (a !== "baja" && a !== "precios") ? FINALES.invalido : null;
  if (final) {
    return (
      <Shell>
        <h1 className="font-display text-[32px] text-fg">{final.titulo}</h1>
        <p className="text-body text-fg-muted">{final.cuerpo}</p>
      </Shell>
    );
  }
  const x = TEXTOS[a as "baja" | "precios"];
  return (
    <Shell>
      <h1 className="font-display text-[32px] text-fg">{x.titulo}</h1>
      <p className="text-body text-fg-muted">{x.cuerpo}</p>
      <form action={accionRed}>
        <input type="hidden" name="t" value={t} />
        <input type="hidden" name="a" value={a} />
        <button type="submit" className="w-full border border-border px-md py-sm text-body text-fg hover:bg-surface-0 transition-colors">{x.boton}</button>
      </form>
    </Shell>
  );
}
