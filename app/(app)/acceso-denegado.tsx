"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
        <h1 className="text-heading font-semibold text-fg">
          Esta cuenta no tiene acceso.
        </h1>
        <p className="text-body text-fg-muted">
          Entrá con la cuenta autorizada o pedile a Franco que te habilite.
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
