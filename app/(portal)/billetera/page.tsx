/**
 * Billetera de Documentación (porteo FIEL de "Gestión de Documentación -
 * EVENT.LOG" de Stitch). Título monumental "DIGITAL WALLET", grilla bento de
 * documentos (Seguro AP aprobado, Licencia vencida, Certificación RCP en
 * revisión) + zona de carga. Estilos exactos de Stitch en valores arbitrarios.
 * Copy tal cual (español, se ajusta después). Contenido de ejemplo estático: el
 * layout del portal ya pone el sidebar y el <main md:pl-[280px]>.
 */

import {
  ShieldPlus,
  Car,
  BriefcaseMedical,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  Upload,
  UploadCloud,
} from "lucide-react";

export default function BilleteraPage() {
  return (
    <div className="max-w-[1440px] mx-auto w-full px-6 md:px-20 py-16 md:py-24">
      {/* Header */}
      <header className="mb-12 md:mb-40">
        <h1 className="font-[family-name:var(--font-syne)] text-[64px] md:text-[128px] font-extrabold leading-none tracking-[-0.05em] uppercase text-[#e5e2e1] mb-2">
          BILLETERA
          <br />
          DE DOCS
        </h1>
        <p className="text-[18px] leading-[1.6] text-[#cfc4c5] max-w-[672px]">
          Gestión centralizada de credenciales y certificaciones del personal
          operativo. Mantenga su documentación actualizada para garantizar
          asignaciones sin interrupciones.
        </p>
      </header>

      {/* Documentation Grid (Bento) */}
      <div className="grid grid-cols-12 gap-8">
        {/* Seguro AP */}
        <article className="col-span-12 md:col-span-6 border border-[#1A1A1A] bg-[#0e0e0e] p-6 hover:border-[#dde1ff] transition-colors duration-300 flex flex-col justify-between min-h-[300px]">
          <div className="flex justify-between items-start mb-12">
            <div>
              <h2 className="font-[family-name:var(--font-syne)] text-[32px] font-semibold leading-[1.2] tracking-[-0.01em] text-[#e5e2e1] uppercase mb-2">
                Seguro AP
              </h2>
              <span className="label-tech text-[12px] text-[#cfc4c5]">
                Accidentes Personales
              </span>
            </div>
            <ShieldPlus size={36} strokeWidth={1.5} className="text-[#cfc4c5]" />
          </div>
          <div>
            <div className="border-b border-[#1A1A1A] pb-4 mb-4 flex justify-between items-center">
              <span className="label-tech text-[12px] text-[#cfc4c5]">Estado</span>
              <div className="flex items-center gap-2 text-[#81C784]">
                <CheckCircle2 size={20} />
                <span className="label-tech text-[12px]">Aprobado</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="label-tech text-[12px] text-[#cfc4c5]">
                Vencimiento
              </span>
              <span className="text-[16px] text-[#e5e2e1]">15.10.2024</span>
            </div>
            <button
              type="button"
              className="w-full mt-6 py-4 border border-[#1A1A1A] text-[#e5e2e1] hover:bg-[#353535] transition-colors label-tech text-[12px] tracking-[0.1em] flex items-center justify-center gap-2"
            >
              <Eye size={18} /> Ver Documento
            </button>
          </div>
        </article>

        {/* Licencia */}
        <article className="col-span-12 md:col-span-6 border border-[#1A1A1A] bg-[#0e0e0e] p-6 hover:border-[#dde1ff] transition-colors duration-300 flex flex-col justify-between min-h-[300px]">
          <div className="flex justify-between items-start mb-12">
            <div>
              <h2 className="font-[family-name:var(--font-syne)] text-[32px] font-semibold leading-[1.2] tracking-[-0.01em] text-[#e5e2e1] uppercase mb-2">
                Licencia
              </h2>
              <span className="label-tech text-[12px] text-[#cfc4c5]">
                Conducir Cat. B1
              </span>
            </div>
            <Car size={36} strokeWidth={1.5} className="text-[#cfc4c5]" />
          </div>
          <div>
            <div className="border-b border-[#1A1A1A] pb-4 mb-4 flex justify-between items-center">
              <span className="label-tech text-[12px] text-[#cfc4c5]">Estado</span>
              <div className="flex items-center gap-2 text-[#ffb4ab]">
                <AlertCircle size={20} />
                <span className="label-tech text-[12px]">Vencido</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="label-tech text-[12px] text-[#cfc4c5]">
                Vencimiento
              </span>
              <span className="text-[16px] text-[#ffb4ab]">01.02.2024</span>
            </div>
            <button
              type="button"
              className="w-full mt-6 py-4 bg-[#e2e2e2] text-[#000000] hover:bg-transparent hover:text-[#e2e2e2] border border-transparent hover:border-[#e2e2e2] transition-all duration-150 label-tech text-[12px] tracking-[0.1em] flex items-center justify-center gap-2"
            >
              <Upload size={18} /> Actualizar
            </button>
          </div>
        </article>

        {/* Certificación RCP */}
        <article className="col-span-12 lg:col-span-8 border border-[#1A1A1A] bg-[#0e0e0e] p-6 hover:border-[#dde1ff] transition-colors duration-300 flex flex-col justify-between min-h-[300px]">
          <div className="flex justify-between items-start mb-12">
            <div>
              <h2 className="font-[family-name:var(--font-syne)] text-[32px] font-semibold leading-[1.2] tracking-[-0.01em] text-[#e5e2e1] uppercase mb-2">
                Certificación RCP
              </h2>
              <span className="label-tech text-[12px] text-[#cfc4c5]">
                Primeros Auxilios Avanzados
              </span>
            </div>
            <BriefcaseMedical size={36} strokeWidth={1.5} className="text-[#cfc4c5]" />
          </div>
          <div>
            <div className="border-b border-[#1A1A1A] pb-4 mb-4 flex justify-between items-center">
              <span className="label-tech text-[12px] text-[#cfc4c5]">Estado</span>
              <div className="flex items-center gap-2 text-[#cfc4c5]">
                <Clock size={20} />
                <span className="label-tech text-[12px]">En Revisión</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="label-tech text-[12px] text-[#cfc4c5]">Emitido</span>
              <span className="text-[16px] text-[#e5e2e1]">20.03.2024</span>
            </div>
            <div className="mt-6 flex gap-4">
              <button
                type="button"
                disabled
                className="flex-1 py-4 border border-[#1A1A1A] text-[#e5e2e1] hover:bg-[#353535] transition-colors label-tech text-[12px] tracking-[0.1em] flex items-center justify-center gap-2 opacity-50 cursor-not-allowed"
              >
                <Eye size={18} /> Ver
              </button>
            </div>
          </div>
        </article>

        {/* Upload Area */}
        <div className="col-span-12 lg:col-span-4 border border-dashed border-[#4c4546] bg-[#20201f] p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-[#2a2a2a] transition-colors min-h-[300px]">
          <UploadCloud size={56} strokeWidth={1.5} className="text-[#cfc4c5] mb-4" />
          <h3 className="font-[family-name:var(--font-syne)] text-[32px] font-semibold leading-[1.2] tracking-[-0.01em] text-[#e5e2e1] mb-2">
            NUEVO DOC
          </h3>
          <p className="label-tech text-[12px] text-[#cfc4c5] max-w-[200px]">
            Arrastre o seleccione PDF / JPG (Max 5MB)
          </p>
        </div>
      </div>
    </div>
  );
}
