/**
 * Editar perfil del STAFF (fork "staff con cuenta") con DATOS REALES. Gate por
 * identidad (requireStaff). Prefill del form con el perfil real y guardado
 * self-scoped vía RPC. Chrome propio del staff (StaffNav). Estilos Stitch.
 */

export const dynamic = "force-dynamic";

import { StaffNav } from "@/components/staff-nav";
import { requireStaff } from "@/lib/staff";
import { EditProfileForm } from "./edit-profile-form";


export default async function EditarPerfilStaffPage() {
  const profile = await requireStaff();

  return (
    <div className="min-h-dvh bg-[#131313] text-[#e5e2e1] antialiased flex flex-col md:flex-row">
      <StaffNav />
      <main className="flex-1 w-full md:pl-[280px] pt-16 md:pt-0 pb-[100px] md:pb-0">
        <div className="max-w-[900px] mx-auto px-6 md:px-20 py-12 md:py-24 flex flex-col gap-12">
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
        </div>
      </main>
    </div>
  );
}
