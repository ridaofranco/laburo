/**
 * Pagos y Liquidaciones (porteo FIEL de "LABURO - Payments & Settlements" de
 * Stitch). Estética blueprint / tipografía monumental: grid de totales gigantes,
 * y tablas de aprobación de presupuestos y pagos pendientes con grilla de 12
 * columnas. Datos ESTÁTICOS tal cual el HTML de Stitch (sin Supabase). Copy en
 * inglés, exactamente como el original. Tokens Material mapeados a hex
 * arbitrarios (primary #c6c6c6, on-primary #303030, outline-variant #4c4546,
 * on-surface-variant #cfc4c5, surface #131313, surface-container-highest
 * #353535); Material Symbols -> lucide-react. Radio 0px. El layout del portal ya
 * pone el sidebar + <main md:pl-[280px]>, así que esto es SOLO el contenido.
 */

const totals = [
  { label: "Pendiente de autorización", amount: "$42,500", dim: false },
  { label: "Liquidaciones completadas", amount: "$128,400", dim: true },
];

const budgets = [
  {
    date: "Oct 24, 2023",
    event: "Main Stage Rigging",
    role: "Technical Direction",
    amount: "$12,000",
  },
];

const pending = [
  {
    date: "Oct 22, 2023",
    event: "Festival Visuals Package",
    role: "VFX Studio",
    amount: "$8,500",
  },
  {
    date: "Oct 20, 2023",
    event: "Security Staffing",
    role: "Operations",
    amount: "$22,000",
  },
];

export default function PagosPage() {
  return (
    <div className="max-w-[1440px] mx-auto w-full px-6 md:px-20 py-16 md:py-24">
      {/* Page Title */}
      <div className="mb-40">
        <h2 className="font-[family-name:var(--font-syne)] text-[40px] md:text-[64px] font-bold text-[#c6c6c6] leading-[1.1] tracking-[-0.02em]">
          Pagos y Liquidaciones
        </h2>
      </div>

      {/* Monumental Totals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-40">
        {totals.map((t) => (
          <div
            key={t.label}
            className="flex flex-col gap-2 p-6 border border-[#4c4546] bg-[#131313] hover:border-[#c6c6c6] transition-colors"
          >
            <span className="label-tech text-[12px] text-[#cfc4c5]">
              {t.label}
            </span>
            <span
              className={`font-[family-name:var(--font-syne)] text-[64px] md:text-[120px] font-extrabold text-[#c6c6c6] leading-[1.1] tracking-[-0.04em] ${
                t.dim ? "opacity-50" : ""
              }`}
            >
              {t.amount}
            </span>
          </div>
        ))}
      </div>

      {/* Approve Budgets Section */}
      <section className="mb-40">
        <div className="flex items-baseline justify-between border-b border-[#4c4546] pb-6 mb-12">
          <h3 className="font-[family-name:var(--font-syne)] text-[32px] font-semibold text-[#c6c6c6] leading-[1.2] tracking-[-0.01em]">
            Aprobar presupuestos
          </h3>
          <span className="label-tech text-[12px] text-[#cfc4c5]">
            Vista de productor
          </span>
        </div>
        <div className="flex flex-col gap-0">
          {/* Table Header Equivalent */}
          <div className="hidden md:grid grid-cols-12 gap-4 pb-4 border-b border-[#4c4546] text-[#cfc4c5] label-tech text-[12px]">
            <div className="col-span-2">Fecha</div>
            <div className="col-span-4">Contexto del evento</div>
            <div className="col-span-3">Rol / Departamento</div>
            <div className="col-span-2 text-right">Monto</div>
            <div className="col-span-1" />
          </div>
          {budgets.map((b) => (
            <div
              key={b.event}
              className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-[#4c4546] items-center group"
            >
              <div className="col-span-2 text-[16px] leading-[1.6] text-[#cfc4c5]">
                {b.date}
              </div>
              <div className="col-span-4 text-[18px] leading-[1.6] text-[#c6c6c6]">
                {b.event}
              </div>
              <div className="col-span-3 text-[16px] leading-[1.6] text-[#cfc4c5]">
                {b.role}
              </div>
              <div className="col-span-2 text-left md:text-right text-[18px] leading-[1.6] text-[#c6c6c6]">
                {b.amount}
              </div>
              <div className="col-span-1 flex justify-end">
                <button
                  type="button"
                  className="bg-[#c6c6c6] text-[#303030] px-6 py-3 label-tech text-[12px] hover:bg-transparent hover:text-[#c6c6c6] hover:border hover:border-[#c6c6c6] border border-transparent transition-all w-full md:w-auto"
                >
                  Aprobar
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pending Payments Section */}
      <section className="mb-40">
        <div className="border-b border-[#4c4546] pb-6 mb-12">
          <h3 className="font-[family-name:var(--font-syne)] text-[32px] font-semibold text-[#c6c6c6] leading-[1.2] tracking-[-0.01em]">
            Pagos pendientes
          </h3>
        </div>
        <div className="flex flex-col gap-0">
          {pending.map((p) => (
            <div
              key={p.event}
              className="grid grid-cols-1 md:grid-cols-12 gap-4 py-6 border-b border-[#4c4546] items-center group"
            >
              <div className="col-span-2 text-[16px] leading-[1.6] text-[#cfc4c5]">
                {p.date}
              </div>
              <div className="col-span-4 text-[18px] leading-[1.6] text-[#c6c6c6]">
                {p.event}
              </div>
              <div className="col-span-3 text-[16px] leading-[1.6] text-[#cfc4c5]">
                {p.role}
              </div>
              <div className="col-span-2 text-left md:text-right text-[18px] leading-[1.6] text-[#c6c6c6]">
                {p.amount}
              </div>
              <div className="col-span-1 flex justify-end">
                <button
                  type="button"
                  className="bg-[#353535] text-[#c6c6c6] border border-[#4c4546] px-6 py-3 label-tech text-[12px] hover:border-[#c6c6c6] transition-all w-full md:w-auto"
                >
                  Liquidar
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
