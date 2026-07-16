import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccesoDenegado } from "./acceso-denegado";

/**
 * Gate de auth + membresía (D-06). Adaptado del layout de org de HITO,
 * sin slug routing ni redirect de alta: LABURO v1 tiene una sola org.
 *
 * La autoridad real es la RLS de staff_app (is_org_member): un no-miembro
 * recibe 0 filas de la vista aunque saltee esta pantalla. Este layout es
 * defensa en profundidad.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Vista security-invoker filtrada a auth.uid() (0 filas = sin acceso).
  const { data: membership } = await supabase
    .from("staff_app_my_membership")
    .select("role")
    .maybeSingle();

  if (!membership) {
    return <AccesoDenegado />;
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-10 bg-surface-1 border-b border-border px-md py-sm pt-[max(var(--spacing-sm),env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-md">
          <span className="font-lockup text-glow text-[28px] select-none">
            LABURO
          </span>
          <nav className="flex items-center gap-xs" aria-label="Secciones">
            <Link
              href="/"
              className="inline-flex items-center min-h-[44px] rounded-full bg-surface-2 border border-border text-fg text-label font-semibold px-md"
            >
              Buscar
            </Link>
            <Link
              href="/tablero"
              className="inline-flex items-center min-h-[44px] rounded-full bg-surface-2 border border-border text-fg text-label font-semibold px-md"
            >
              Tablero
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 w-full max-w-[520px] mx-auto px-md py-lg pb-[max(var(--spacing-lg),env(safe-area-inset-bottom))]">
        {children}
      </main>
    </div>
  );
}
