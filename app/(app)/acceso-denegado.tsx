"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SOPORTE_EMAIL } from "@/lib/soporte";

/**
 * Pantalla "sin acceso" (D-06, UI-SPEC § Screen States → Access denied).
 * Un login válido pero no autorizado NUNCA ve el pool: solo esto.
 * "Cerrar sesión" es no destructivo, sin diálogo de confirmación.
 */
export function AccesoDenegado() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <main className="min-h-dvh flex items-center justify-center px-md">
      <div className="w-full max-w-[360px] flex flex-col items-center text-center gap-md">
        <h1 className="font-display text-[28px] text-fg">
          Esta cuenta no tiene acceso.
        </h1>
        {/* 29/10: la pantalla era un callejón. Quien llega acá casi siempre
         *  entró con un mail que todavía no tiene productora, perfil de staff
         *  ni de proveedor: lo que necesita es el alta, no solo un mail. */}
        <p className="text-body text-fg-muted">
          Con este mail todavía no hay una productora, un perfil para trabajar ni
          un servicio publicado. Si querés usar LABURO, creá tu cuenta: es gratis.
        </p>
        <Link
          href="/registrarme"
          className="min-h-[44px] w-full inline-flex items-center justify-center rounded-xl bg-[#0047ff] text-white text-label font-semibold px-lg py-sm transition-transform active:scale-[0.98]"
        >
          Crear mi cuenta
        </Link>
        <p className="text-[13px] text-fg-muted">
          Si creés que es un error, escribinos a{" "}
          <a href={`mailto:${SOPORTE_EMAIL}`} className="underline">
            {SOPORTE_EMAIL}
          </a>
          .
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={loading}
          className="min-h-[44px] rounded-xl bg-surface-2 border border-border text-fg text-label font-semibold px-lg py-sm transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? "Cerrando…" : "Cerrar sesión"}
        </button>
      </div>
    </main>
  );
}
