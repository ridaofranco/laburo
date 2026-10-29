/**
 * Editar perfil del STAFF (fork "staff con cuenta") con DATOS REALES. Gate por
 * identidad (requireStaff). Prefill del form con el perfil real y guardado
 * self-scoped vía RPC. Chrome propio del staff (StaffNav). Estilos Stitch.
 */

export const dynamic = "force-dynamic";

import Link from "next/link";
import { StaffNav } from "@/components/staff-nav";
import { requireStaff } from "@/lib/staff";
import { EditProfileForm } from "./edit-profile-form";


export default async function EditarPerfilStaffPage() {
  const profile = await requireStaff();

  return (
    <div className="min-h-dvh bg-[#131313] text-[#e5e2e1] antialiased flex flex-col md:flex-row">
      <StaffNav />
      <main className="flex-1 w-full md:pl-[280px] pt-16 md:pt-0 pb-[100px] md:pb-0">
        <div className="w-full max-w-[900px] mx-auto px-6 md:px-20 py-12 md:py-24 flex flex-col gap-12">
          <header className="border-b border-[#1A1A1A] pb-6">
            <p className="label-tech text-[12px] uppercase tracking-[0.2em] text-[#c6c6c6] mb-3">
              Tu perfil
            </p>
            <h1 className="t-display text-[#e5e2e1] uppercase">
              Editar perfil
            </h1>
            <p className="text-[16px] text-[#cfc4c5] mt-4 max-w-[560px] leading-[1.6]">
              Mantené tus datos al día para que las agencias te encuentren y te
              manden las ofertas que van con vos.
            </p>
          </header>
          <EditProfileForm profile={profile} />
          {/* La elección de si otras productoras ven el perfil (0076). Antes
           *  solo se llegaba desde el link del mail. */}
          <section className="border-t border-[#1A1A1A] pt-8 flex flex-col gap-3">
            <h2 className="label-tech text-[12px] uppercase tracking-[0.2em] text-[#c6c6c6]">
              Quién ve tu perfil
            </h2>
            <p className="text-[15px] text-[#cfc4c5] max-w-[560px] leading-[1.6]">
              Elegí si querés que otras productoras que usan LABURO puedan ver tu
              perfil y mandarte ofertas. Lo podés cambiar cuando quieras.
            </p>
            <Link
              href="/mi-visibilidad"
              className="self-start label-tech text-[12px] uppercase tracking-[0.15em] text-[#e5e2e1] border-b border-[#4c4546] hover:border-[#e5e2e1] pb-1 transition-colors"
            >
              Elegir quién me ve
            </Link>
          </section>
        </div>
      </main>
    </div>
  );
}
