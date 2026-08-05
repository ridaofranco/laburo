/**
 * La puerta de entrada del proveedor (marketplace, movimiento 2), server component.
 *
 * Hasta acá el proveedor era pasivo: lo cargaba la productora y no podía entrar
 * a nada. Con esta pantalla entra desde el teléfono con el link que le pasaron,
 * SIN cuenta y sin contraseña, completa sus datos, dice qué servicios presta y
 * se publica solo.
 *
 * Vive a NIVEL RAÍZ (fuera del grupo (app)) a propósito, igual que /o/[token]:
 * el layout de (app) hace el gate de membresía y mandaría al proveedor a /login.
 * "/acceso-proveedor" está en publicPrefixes del middleware para que la ruta no
 * se intercepte, con el prefijo entero (un prefijo corto abriría /pagos, porque
 * esa lista se evalúa con startsWith).
 *
 * GET seguro: llama a public.staff_app_proveedor_perfil con el cliente server
 * anon (acá no hay sesión, y está bien porque la RPC es por token). La RPC valida
 * adentro hash + vencimiento + tipo proveedor + activo, y de paso estampa
 * access_token_last_used_at, que es un efecto lateral aceptable en un GET.
 * `force-dynamic` garantiza que eso corra en cada request y que nunca se sirva
 * un RSC cacheado con los datos de otro.
 *
 * Sin datos (token inventado, vencido o revocado) se renderiza la pantalla sin
 * acceso y NADA más: cero segunda consulta, cero dato del proveedor. La RPC no
 * distingue "no existe" de "venció", así que la pantalla tampoco.
 *
 * Toda mutación vive en actions.ts (Server Actions, POST). Esta página sólo lee.
 */

import { createClient } from "@/lib/supabase/server";
import { PanelProveedor } from "@/components/proveedor/panel-proveedor";
import { WhatsAppCta } from "./wa-cta";
import { TERMINAL_COPY, type PerfilProveedor } from "./estados";
import { LaburoWordmark } from "@/components/laburo-wordmark";
import type { CampoFormulario } from "@/lib/formulario-consulta";

// La RPC estampa el último uso del link: nunca servir esto cacheado.
export const dynamic = "force-dynamic";

/** Contenedor mobile-first. El root layout ya da html/body/fonts/Toaster; esta
 *  ruta no hereda el <main> centrado de (app), así que trae el suyo. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-surface-0">
      <header className="px-md py-md pt-[max(var(--spacing-md),env(safe-area-inset-top))]">
        <LaburoWordmark className="h-[24px] w-auto" />
      </header>
      <main className="flex-1 w-full max-w-[440px] mx-auto px-md pb-[max(var(--spacing-2xl),env(safe-area-inset-bottom))]">
        {children}
      </main>
    </div>
  );
}


/** Pantalla sin acceso: sin formulario, sin datos, pero con una salida real. */
function SinAcceso() {
  const c = TERMINAL_COPY.sin_acceso;
  return (
    <div className="flex flex-col gap-md rounded-none bg-surface-1 border border-border p-lg mt-xl">
      <h1 className="font-display text-[32px] text-fg">{c.title}</h1>
      <p className="text-body text-fg-muted">{c.body}</p>
      <WhatsAppCta label={c.wa.label} mensaje={c.wa.mensaje} />
    </div>
  );
}

export default async function AccesoProveedorPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  // Dos lecturas, las dos por token y las dos validadas adentro de su RPC. Van
  // en paralelo porque son independientes: el formulario de consulta (0058) se
  // guarda en su propia tabla y no cuelga del perfil.
  const [{ data }, { data: dataForm }] = await Promise.all([
    supabase.rpc("staff_app_proveedor_perfil", { p_token: token }),
    supabase.rpc("staff_app_proveedor_formulario", { p_token: token }),
  ]);

  if (!data) {
    return (
      <Shell>
        <SinAcceso />
      </Shell>
    );
  }

  const form = (dataForm ?? null) as { campos?: CampoFormulario[]; intro?: string | null } | null;

  return (
    <Shell>
      <PanelProveedor
        acceso={{ por: "token", token }}
        data={data as PerfilProveedor}
        form={form}
      />
    </Shell>
  );
}
