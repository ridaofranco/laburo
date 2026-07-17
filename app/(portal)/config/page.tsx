/**
 * Ajustes de Agencia (porteo FIEL de "LABURO - Agency Settings" de Stitch).
 * Bento de 12 columnas: Agency Profile (8) + Billing (4) + Team Access (12) +
 * barra de acciones globales. Estilos exactos de Stitch en valores arbitrarios,
 * consistentes con el portal ya aprobado (cards #0A0A0A / borde #1A1A1A, texto
 * #e5e2e1, secundario #cfc4c5, primary #c6c6c6). Copy EXACTO de Stitch. Server
 * component estático: los inputs son de solo lectura (sin onChange). El layout
 * del portal ya aporta el sidebar y el <main md:pl-[280px]>.
 */

import {
  Building2,
  CreditCard,
  ShieldCheck,
  Upload,
  Pencil,
  ReceiptText,
  UserPlus,
  MoreHorizontal,
  Trash2,
} from "lucide-react";

interface Member {
  initials: string;
  name: string;
  email: string;
  role: string;
  lastActive: string;
  owner?: boolean;
}

const MEMBERS: Member[] = [
  {
    initials: "MS",
    name: "Maria Santos",
    email: "maria@laburo.group",
    role: "Dueño",
    lastActive: "Recién",
    owner: true,
  },
  {
    initials: "JP",
    name: "Javier Peña",
    email: "javier@laburo.group",
    role: "Admin",
    lastActive: "Hace 2 horas",
  },
  {
    initials: "LC",
    name: "Lucia Costa",
    email: "lucia@laburo.group",
    role: "Coordinador",
    lastActive: "Hace 1 día",
  },
];

export default function ConfigPage() {
  return (
    <div className="max-w-[1440px] mx-auto w-full px-6 md:px-20 py-16 md:py-24">
      {/* Page Header */}
      <div className="mb-12">
        <h2 className="font-[family-name:var(--font-syne)] text-[40px] md:text-[64px] font-bold leading-[1.1] tracking-tight text-[#e5e2e1] mb-2">
          Ajustes de Agencia
        </h2>
        <p className="text-[18px] leading-[1.6] text-[#cfc4c5] max-w-[672px]">
          Configurá los parámetros operativos, el acceso del equipo y los
          detalles de la suscripción de tu organización.
        </p>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Section 1: Agency Profile (8 cols) */}
        <section className="lg:col-span-8 flex flex-col gap-6">
          <div className="border border-[#1A1A1A] bg-[#0A0A0A] p-6 lg:p-10 hover:border-[#c6c6c6]/50 transition-colors duration-300">
            <div className="flex items-center justify-between mb-6 pb-2 border-b border-[#1A1A1A]">
              <h3 className="font-[family-name:var(--font-syne)] text-[32px] font-semibold text-[#e5e2e1] flex items-center gap-3 leading-tight">
                <Building2 size={24} className="shrink-0" />
                Perfil de la agencia
              </h3>
              <button className="label-tech text-[12px] text-[#c6c6c6] hover:text-[#e5e2e1] transition-colors uppercase tracking-[0.1em]">
                Editar
              </button>
            </div>

            <div className="flex flex-col md:flex-row gap-6 md:gap-12 items-start">
              {/* Logo */}
              <div className="relative group shrink-0">
                <div
                  className="w-32 h-32 bg-cover bg-center border border-[#4c4546]"
                  style={{
                    backgroundImage:
                      "url('https://lh3.googleusercontent.com/aida-public/AB6AXuA4l9yzuQLF59GWNQpliNX4GatyF3s6tr8Bb4XtfR6RJySYP0_Dk-NHozFco-IaS66S8wEYicM-YKJGfUUQ3F26PsClNEorYc2yK4B-hn0NOGWCvzcAjKxzqRWalMtdeYDYoJ3p5dKCYy5tj9MjBeN6jVHjgxZiCVNOo40x-J4BUw1gJoOOdQ2kR0Jfu-FDXftRKQSIOrH0eAMVJxanvvZdi9u9X_78BnP6rfHc1KYhCw_V55MyPYX44lL8d_eknneRG8BRa6uuY_c')",
                  }}
                />
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border border-[#c6c6c6]">
                  <Upload size={20} className="text-[#c6c6c6]" />
                </div>
              </div>

              {/* Fields */}
              <div className="flex-1 w-full flex flex-col gap-6">
                <div className="group relative">
                  <label className="label-tech text-[12px] text-[#cfc4c5] absolute -top-5 left-0 uppercase tracking-[0.1em] transition-colors group-focus-within:text-[#c6c6c6]">
                    Nombre de la agencia
                  </label>
                  <input
                    readOnly
                    type="text"
                    defaultValue="LABURO Group"
                    placeholder="Ingresá el nombre de la agencia"
                    className="w-full bg-transparent border-0 border-b border-[#4c4546] text-[#e5e2e1] text-[18px] py-2 px-0 focus:ring-0 focus:border-[#c6c6c6] transition-colors placeholder:text-[#cfc4c5]/50 focus:outline-none"
                  />
                </div>

                <div className="group relative mt-4">
                  <label className="label-tech text-[12px] text-[#cfc4c5] absolute -top-5 left-0 uppercase tracking-[0.1em] transition-colors group-focus-within:text-[#c6c6c6]">
                    Descripción
                  </label>
                  <textarea
                    readOnly
                    rows={3}
                    defaultValue="Soluciones premium de staff y gestión de eventos para clientes corporativos de alta gama. Precisión radical en cada detalle."
                    className="w-full bg-transparent border-0 border-b border-[#4c4546] text-[#e5e2e1] text-[18px] leading-[1.6] py-2 px-0 focus:ring-0 focus:border-[#c6c6c6] transition-colors placeholder:text-[#cfc4c5]/50 resize-none focus:outline-none"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mt-2">
                  <div className="group relative flex-1">
                    <label className="label-tech text-[12px] text-[#cfc4c5] absolute -top-5 left-0 uppercase tracking-[0.1em]">
                      Ubicación
                    </label>
                    <input
                      readOnly
                      type="text"
                      defaultValue="Buenos Aires, AR"
                      className="w-full bg-transparent border-0 border-b border-[#4c4546] text-[#e5e2e1] text-[16px] py-2 px-0 focus:ring-0 focus:border-[#c6c6c6] transition-colors focus:outline-none"
                    />
                  </div>
                  <div className="group relative flex-1">
                    <label className="label-tech text-[12px] text-[#cfc4c5] absolute -top-5 left-0 uppercase tracking-[0.1em]">
                      CUIT
                    </label>
                    <input
                      readOnly
                      type="text"
                      defaultValue="30-71234567-8"
                      className="w-full bg-transparent border-0 border-b border-[#4c4546] text-[#e5e2e1] text-[16px] py-2 px-0 focus:ring-0 focus:border-[#c6c6c6] transition-colors focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Billing (4 cols) */}
        <section className="lg:col-span-4 flex flex-col gap-6">
          <div className="border border-[#1A1A1A] bg-[#0A0A0A] p-6 lg:p-10 h-full flex flex-col hover:border-[#c6c6c6]/50 transition-colors duration-300">
            <div className="flex items-center justify-between mb-6 pb-2 border-b border-[#1A1A1A]">
              <h3 className="font-[family-name:var(--font-syne)] text-[32px] font-semibold text-[#e5e2e1] flex items-center gap-3 leading-tight">
                <CreditCard size={24} className="shrink-0" />
                Facturación
              </h3>
            </div>

            <div className="flex-1 flex flex-col">
              <div className="bg-[#131313] border border-[#1A1A1A] p-6 mb-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="label-tech text-[12px] text-[#cfc4c5] uppercase tracking-[0.1em] mb-1">
                      Plan actual
                    </p>
                    <h4 className="font-[family-name:var(--font-syne)] text-[32px] font-semibold text-[#e5e2e1] leading-tight">
                      Enterprise
                    </h4>
                  </div>
                  <span className="bg-[#c6c6c6]/10 text-[#c6c6c6] border border-[#c6c6c6]/30 px-2 py-1 label-tech text-[12px] uppercase tracking-[0.1em]">
                    Activo
                  </span>
                </div>

                <div className="space-y-3 mt-6">
                  <div className="flex justify-between items-center border-b border-[#4c4546]/50 pb-2">
                    <span className="text-[16px] text-[#cfc4c5]">Puestos</span>
                    <span className="text-[16px] text-[#e5e2e1]">12 / 15</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-[#4c4546]/50 pb-2">
                    <span className="text-[16px] text-[#cfc4c5]">Almacenamiento</span>
                    <span className="text-[16px] text-[#e5e2e1]">45GB / 100GB</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[16px] text-[#cfc4c5]">Próxima factura</span>
                    <span className="text-[16px] text-[#e5e2e1]">01 oct 2024</span>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-6 flex flex-col gap-3">
                <button className="w-full bg-transparent text-[#c6c6c6] label-tech text-[12px] py-3 px-4 border border-[#c6c6c6] hover:bg-[#c6c6c6]/5 transition-all duration-150 uppercase tracking-[0.1em]">
                  Gestionar suscripción
                </button>
                <button className="w-full text-[#cfc4c5] label-tech text-[12px] py-2 px-4 hover:text-[#e5e2e1] transition-colors uppercase tracking-[0.1em] flex items-center justify-center gap-2">
                  <ReceiptText size={16} />
                  Ver facturas
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Team Access (12 cols) */}
        <section className="lg:col-span-12 mt-6">
          <div className="border border-[#1A1A1A] bg-[#0A0A0A] p-6 lg:p-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-2 border-b border-[#1A1A1A] gap-4">
              <h3 className="font-[family-name:var(--font-syne)] text-[32px] font-semibold text-[#e5e2e1] flex items-center gap-3 leading-tight">
                <ShieldCheck size={24} className="shrink-0" />
                Acceso del equipo
              </h3>
              <button className="bg-[#e5e2e1] text-black label-tech text-[12px] py-2 px-6 hover:bg-transparent hover:text-[#e5e2e1] border border-[#e5e2e1] transition-all duration-150 uppercase tracking-[0.1em] flex items-center justify-center gap-2">
                <UserPlus size={16} />
                Invitar miembro
              </button>
            </div>

            {/* User list */}
            <div className="flex flex-col">
              {/* Header row */}
              <div className="hidden md:grid grid-cols-12 gap-4 pb-4 border-b border-[#1A1A1A] mb-4">
                <div className="col-span-4 label-tech text-[12px] text-[#cfc4c5] uppercase tracking-[0.1em]">
                  Usuario
                </div>
                <div className="col-span-3 label-tech text-[12px] text-[#cfc4c5] uppercase tracking-[0.1em]">
                  Rol
                </div>
                <div className="col-span-3 label-tech text-[12px] text-[#cfc4c5] uppercase tracking-[0.1em]">
                  Última actividad
                </div>
                <div className="col-span-2 label-tech text-[12px] text-[#cfc4c5] uppercase tracking-[0.1em] text-right">
                  Acciones
                </div>
              </div>

              {MEMBERS.map((m, i) => (
                <div
                  key={m.email}
                  className={`grid grid-cols-1 md:grid-cols-12 gap-4 items-center py-6 ${
                    i === MEMBERS.length - 1 ? "" : "border-b border-[#1A1A1A]"
                  } hover:bg-[#353535]/20 transition-colors px-2 -mx-2`}
                >
                  <div className="col-span-1 md:col-span-4 flex items-center gap-4">
                    <div
                      className={`h-10 w-10 flex items-center justify-center shrink-0 ${
                        m.owner
                          ? "bg-[#c6c6c6]/20 border border-[#c6c6c6]/30"
                          : "bg-[#393939] border border-[#4c4546]"
                      }`}
                    >
                      <span
                        className={`label-tech text-[12px] ${
                          m.owner ? "text-[#c6c6c6]" : "text-[#e5e2e1]"
                        }`}
                      >
                        {m.initials}
                      </span>
                    </div>
                    <div>
                      <p className="text-[16px] text-[#e5e2e1] font-medium">
                        {m.name}
                      </p>
                      <p className="label-tech text-[12px] text-[#cfc4c5]">
                        {m.email}
                      </p>
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-3">
                    <span
                      className={`inline-block px-2 py-1 label-tech text-[12px] uppercase tracking-[0.1em] border ${
                        m.owner
                          ? "bg-[#c6c6c6]/10 text-[#c6c6c6] border-[#c6c6c6]/30"
                          : "bg-[#353535] text-[#e5e2e1] border-[#4c4546]"
                      }`}
                    >
                      {m.role}
                    </span>
                  </div>

                  <div className="col-span-1 md:col-span-3 text-[16px] text-[#cfc4c5]">
                    {m.lastActive}
                  </div>

                  <div className="col-span-1 md:col-span-2 flex justify-start md:justify-end gap-3">
                    {m.owner ? (
                      <button className="text-[#cfc4c5] hover:text-[#c6c6c6] transition-colors">
                        <MoreHorizontal size={20} />
                      </button>
                    ) : (
                      <>
                        <button className="text-[#cfc4c5] hover:text-[#c6c6c6] transition-colors">
                          <Pencil size={20} />
                        </button>
                        <button className="text-[#cfc4c5] hover:text-[#ffb4ab] transition-colors">
                          <Trash2 size={20} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Global Action Area */}
        <section className="lg:col-span-12 mt-12 flex flex-col sm:flex-row justify-end gap-4 border-t border-[#1A1A1A] pt-6">
          <button className="text-[#cfc4c5] label-tech text-[12px] py-3 px-6 hover:text-[#e5e2e1] transition-colors uppercase tracking-[0.1em] border border-transparent hover:border-[#4c4546]">
            Descartar cambios
          </button>
          <button className="bg-[#e5e2e1] text-black label-tech text-[12px] py-3 px-8 hover:bg-transparent hover:text-[#e5e2e1] border border-[#e5e2e1] transition-all duration-150 uppercase tracking-[0.1em]">
            Guardar configuración
          </button>
        </section>
      </div>
    </div>
  );
}
