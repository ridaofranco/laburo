/**
 * /mi-proveedor — el panel del proveedor POR SESIÓN.
 *
 * Es el espejo de `/acceso-proveedor/[token]`, con la misma pantalla exacta
 * (`PanelProveedor`), pero para el proveedor que entró con su cuenta.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 * Hasta el 5/8 el proveedor solo entraba con un link mágico que le llegaba por
 * mail y vencía a los 30 días. Si lo perdía, no entraba más: no tenía cuenta,
 * no aparecía en ninguna pantalla de login, y no había forma de recuperarlo que
 * no fuera pedirle a alguien que se lo regenerara a mano.
 *
 * Decisión de Franco (5/8): "TODOS TIENEN QUE PODER REGISTRARSE EN SU BASE" y
 * que ingresar sea fácil. El link NO se retira: sigue andando para el que ya lo
 * tiene y para el que no quiere cuenta.
 *
 * ── EL VÍNCULO CUENTA ↔ PERFIL ──────────────────────────────────────────────
 * `staff_app_vincular_proveedor` (0045) conecta la sesión con el perfil de
 * proveedor que tenga el mismo mail, UNA sola vez, y estampa el `user_id`. De
 * ahí en adelante todo resuelve por `auth.uid()`. Se llama en `/auth/callback`,
 * que es el único lugar donde se decide identidad; acá solo se lee.
 *
 * Vive a nivel raíz (fuera del grupo (app)) a propósito: el layout de (app) hace
 * el gate de MEMBRESÍA de productora y mandaría al proveedor a /login.
 */

export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LaburoWordmark } from "@/components/laburo-wordmark";
import { PanelProveedor } from "@/components/proveedor/panel-proveedor";
import type { PerfilProveedor } from "@/app/acceso-proveedor/[token]/estados";
import type { CampoFormulario } from "@/lib/formulario-consulta";
import type { ConsultaProveedor } from "@/components/proveedor/consultas";

export const metadata: Metadata = {
  title: "LABURO. | Mi perfil de proveedor",
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-surface-0">
      <header className="px-md py-md pt-[max(var(--spacing-md),env(safe-area-inset-top))] flex items-center justify-between gap-4">
        <LaburoWordmark className="h-[24px] w-auto" />
        {/* El cambio de perfil vuelve a la puerta: si esta persona además es
         * staff o productora, elige de nuevo desde ahí. Es el "seleccionador"
         * que pidió Franco, sin inventar un estado de rol en la sesión. */}
        <Link
          href="/entrar"
          className="label-tech text-[11px] tracking-[0.2em] text-fg-muted hover:text-fg transition-colors"
        >
          Cambiar de perfil
        </Link>
      </header>
      <main className="flex-1 w-full max-w-[440px] mx-auto px-md pb-[max(var(--spacing-2xl),env(safe-area-inset-bottom))]">
        {children}
      </main>
    </div>
  );
}

export default async function MiProveedorPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?como=proveedor");

  const { data } = await supabase.rpc("staff_app_mi_perfil_proveedor");

  // Sin perfil de proveedor: la sesión es válida pero esta persona no es
  // proveedora. No se la deja en una pantalla vacía sin explicación, y no se
  // le dice "no existís": se le ofrece la puerta de alta, que es lo que
  // realmente necesita.
  if (!data) {
    return (
      <Shell>
        <div className="flex flex-col gap-lg pt-md">
          <h1 className="font-display text-[28px] text-fg">
            Todavía no tenés perfil de proveedor
          </h1>
          <p className="text-body text-fg-muted">
            Tu cuenta funciona, pero con este mail no hay ningún proveedor
            cargado. Si prestás un servicio para eventos, publicate y las
            productoras te encuentran.
          </p>
          <div className="flex flex-col gap-sm">
            <Link
              href="/registrar-proveedor"
              className="inline-flex items-center justify-center bg-[#f5f5f5] text-black px-8 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:bg-[#0047ff] hover:text-white transition-colors duration-300"
            >
              Publicar mis servicios
            </Link>
            <Link
              href="/entrar"
              className="label-tech text-[11px] tracking-[0.2em] text-fg-muted hover:text-fg transition-colors text-center pt-2"
            >
              Entrar con otro perfil
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  // Las dos lecturas van juntas: son independientes y sumar un viaje de ida y
  // vuelta en serie es medio segundo mas de pantalla en blanco en un telefono.
  const [{ data: dataForm }, { data: dataConsultas }] = await Promise.all([
    supabase.rpc("staff_app_mi_proveedor_formulario"),
    supabase.rpc("staff_app_mi_proveedor_consultas"),
  ]);
  const form = (dataForm ?? null) as
    | { campos?: CampoFormulario[]; intro?: string | null }
    | null;

  return (
    <Shell>
      <PanelProveedor
        acceso={{ por: "sesion" }}
        data={data as PerfilProveedor}
        form={form}
        consultas={(dataConsultas ?? []) as ConsultaProveedor[]}
      />
    </Shell>
  );
}
