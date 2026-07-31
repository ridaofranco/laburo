/**
 * Billetera de documentos (v2, placeholder HONESTO). El mockup de Stitch traía
 * documentos inventados (Seguro AP aprobado, Licencia vencida, Certificación RCP)
 * que no existen: en v1 no hay modelo de documentos ni carga de archivos del
 * staff. En vez de mostrar data falsa, se declara honesto que es una función que
 * llega más adelante. Mantiene el shell Stitch. Server-safe (sin estado).
 */

import Link from "next/link";
import { FolderArchive } from "lucide-react";

export default function BilleteraPage() {
  return (
    <div className="max-w-[1440px] mx-auto w-full px-6 md:px-20 py-16 md:py-24">
      <header className="mb-16 border-b border-[#4c4546] pb-8">
        <p className="label-tech text-[12px] text-[#cfc4c5] mb-4 tracking-[0.2em]">
          Próximamente
        </p>
        <h1 className="t-display uppercase text-[#e5e2e1] break-words">
          Billetera de
          <br />
          documentos
        </h1>
      </header>

      <div className="max-w-[560px]">
        <div className="w-16 h-16 border border-[#4c4546] grid place-items-center mb-8">
          <FolderArchive size={28} className="text-[#cfc4c5]" />
        </div>
        <p className="text-[18px] leading-[1.7] text-[#cfc4c5]">
          Acá el staff va a poder cargar y mantener sus documentos (seguro,
          licencias, certificaciones) y vos verlos de un vistazo antes de un
          evento. Es una función que llega en una próxima versión, así que por
          ahora no hay nada que mostrar todavía.
        </p>
        <Link
          href="/buscar"
          className="mt-8 inline-block label-tech text-[12px] text-[#e5e2e1] hover:opacity-70 border-b border-[#4c4546] pb-1"
        >
          Volver a buscar staff
        </Link>
      </div>
    </div>
  );
}
