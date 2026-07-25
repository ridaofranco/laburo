/**
 * Página pública de BAJA del pool de LABURO ("no quiero formar parte").
 *
 * Vive a nivel raíz, fuera del grupo (app), porque la persona llega desde el pie
 * de un mail sin cuenta y sin sesión. El gate no es el login: es el token HMAC
 * del link (lib/baja.ts). Sin token válido no se muestra ningún dato ni se puede
 * dar de baja a nadie, y la página no dice si el id existe o no.
 *
 * GET NO CAMBIA NADA. Solo muestra el formulario. La baja se hace por POST
 * (server action), porque los prefetchers de Gmail y WhatsApp abren los links de
 * los mails para armar la preview: con un GET mutante, media tanda quedaría de
 * baja sin que nadie lo pida.
 *
 * El tono es a propósito el mismo que el resto: cero culpa, cero "¿estás
 * seguro?" tres veces. Si alguien quiere irse, se va en un click, y el motivo es
 * opcional. Eso también nos protege: el que puede irse fácil no nos marca spam.
 */

import Link from "next/link";
import { bajaTokenOk } from "@/lib/baja";
import { darDeBaja, volverAlPool } from "./actions";

export const dynamic = "force-dynamic";

// Ni Google ni ningún crawler debería indexar esta pantalla.
export const metadata = {
  title: "Baja del pool · LABURO",
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-surface-0">
      <header className="px-md py-md pt-[max(var(--spacing-md),env(safe-area-inset-top))]">
        <span className="font-lockup text-glow text-[24px] select-none">
          LABURO.
        </span>
      </header>
      <main className="flex-1 w-full max-w-[440px] mx-auto px-md pb-[max(var(--spacing-2xl),env(safe-area-inset-bottom))]">
        {children}
      </main>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-md rounded-none bg-surface-1 border border-border p-lg mt-xl">
      {children}
    </div>
  );
}

export default async function BajaPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; t?: string; estado?: string }>;
}) {
  const { p = "", t = "", estado } = await searchParams;

  // Estado terminal después de una acción, o link inválido.
  if (estado === "baja") {
    return (
      <Shell>
        <Card>
          <h1 className="font-display text-[32px] text-fg">Listo, te sacamos</h1>
          <p className="text-body text-fg-muted">
            No vas a recibir más mails nuestros y tu perfil ya no aparece cuando
            buscamos gente para un evento. Gracias por habernos dado una mano
            hasta acá.
          </p>
          <p className="text-body text-fg-muted">
            Si fue sin querer, o si más adelante querés volver, con este mismo
            link volvés a entrar.
          </p>
          {bajaTokenOk(p, t) ? (
            <form action={volverAlPool}>
              <input type="hidden" name="p" value={p} />
              <input type="hidden" name="t" value={t} />
              <button
                type="submit"
                className="w-full border border-border px-md py-sm text-body text-fg hover:bg-surface-0 transition-colors"
              >
                Quiero volver al pool
              </button>
            </form>
          ) : null}
        </Card>
      </Shell>
    );
  }

  if (estado === "alta") {
    return (
      <Shell>
        <Card>
          <h1 className="font-display text-[32px] text-fg">Volviste</h1>
          <p className="text-body text-fg-muted">
            Tu perfil está activo otra vez. Cuando haya un evento que vaya con lo
            tuyo, te escribimos.
          </p>
          <Link
            href="/acceso-staff"
            className="text-body text-fg underline underline-offset-4"
          >
            Entrar a revisar mi perfil
          </Link>
        </Card>
      </Shell>
    );
  }

  // Sin token válido no mostramos nada ni confirmamos si el id existe.
  if (!bajaTokenOk(p, t)) {
    return (
      <Shell>
        <Card>
          <h1 className="font-display text-[32px] text-fg">Link inválido</h1>
          <p className="text-body text-fg-muted">
            Este link de baja no es válido o está incompleto. Abrilo desde el
            mail que te mandamos, o escribinos y lo resolvemos a mano.
          </p>
          <a
            href="mailto:contacto@somosder.com.ar?subject=Baja%20del%20pool%20de%20LABURO"
            className="text-body text-fg underline underline-offset-4"
          >
            contacto@somosder.com.ar
          </a>
        </Card>
      </Shell>
    );
  }

  // Formulario. Un solo paso, motivo opcional.
  return (
    <Shell>
      <Card>
        <h1 className="font-display text-[32px] text-fg">
          ¿Querés que no te contemplemos más?
        </h1>
        <p className="text-body text-fg-muted">
          Si confirmás, dejás de recibir nuestros mails y tu perfil no vuelve a
          aparecer cuando armamos el equipo de un evento. No perdemos tu ficha,
          así que si algún día querés volver no tenés que cargar todo de nuevo.
        </p>

        <form action={darDeBaja} className="flex flex-col gap-md">
          <input type="hidden" name="p" value={p} />
          <input type="hidden" name="t" value={t} />

          <label className="flex flex-col gap-xs">
            <span className="text-label font-semibold text-fg-muted">
              ¿Nos contás por qué? (opcional)
            </span>
            <textarea
              name="motivo"
              rows={3}
              maxLength={2000}
              placeholder="Lo que sea. Nos sirve para mejorar."
              className="w-full bg-surface-0 border border-border px-md py-sm text-body text-fg placeholder:text-fg-muted focus:outline-none focus:border-fg"
            />
          </label>

          <button
            type="submit"
            className="w-full bg-fg text-surface-0 px-md py-sm text-body font-semibold hover:opacity-90 transition-opacity"
          >
            Confirmar la baja
          </button>
        </form>

        <p className="text-label text-fg-muted">
          Si en realidad lo que te falta es completar tu perfil o cambiar tus
          datos,{" "}
          <Link href="/acceso-staff" className="text-fg underline underline-offset-4">
            entrá acá
          </Link>{" "}
          y lo editás vos.
        </p>
      </Card>
    </Shell>
  );
}
