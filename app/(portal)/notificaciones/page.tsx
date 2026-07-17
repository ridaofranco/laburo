/**
 * Centro de Notificaciones (porteo FIEL de "Centro de Notificaciones - LABURO"
 * de Stitch). Layout de 12 columnas, minimalismo radical: título display gigante,
 * lista de notificaciones con dot de estado + label técnico + timestamp, y botón
 * "Mark All As Read". Estilos exactos de Stitch en valores arbitrarios. Copy tal
 * cual (mezcla ES/EN del diseño original, se ajusta después). Datos estáticos del
 * HTML de Stitch, sin Supabase. El layout del portal ya pone sidebar + <main>.
 */

interface Notif {
  label: string;
  time: string;
  title: string;
  body: string;
  dot: "unread" | "hover" | "error" | "none";
  labelColor: string; // color del label
  titleHover: string; // clase de hover del título
  itemClass?: string; // clases extra del item (ej. leído)
}

const NOTIFS: Notif[] = [
  {
    label: "ALERTA DEL SISTEMA",
    time: "10:42",
    title: "Candidato aceptó oferta",
    body: "El candidato firmó oficialmente la oferta digital y completó los primeros pasos del onboarding.",
    dot: "unread",
    labelColor: "text-[#cfc4c5]",
    titleHover: "group-hover:text-[#c6c6c6]",
  },
  {
    label: "CAMBIO DE HORARIO",
    time: "AYER",
    title: "Cambio de horario en evento",
    body: "Se actualizó el horario de la reunión de producción. Revisá el nuevo cronograma en la pestaña Eventos.",
    dot: "hover",
    labelColor: "text-[#cfc4c5]",
    titleHover: "group-hover:text-[#c6c6c6]",
  },
  {
    label: "ACCIÓN URGENTE REQUERIDA",
    time: "12 OCT",
    title: "Documentación vencida",
    body: "Vencieron documentos críticos de cumplimiento. Es necesario renovarlos de inmediato para seguir operando.",
    dot: "error",
    labelColor: "text-[#ffb4ab]",
    titleHover: "group-hover:text-[#ffb4ab]",
  },
  {
    label: "AVISO GENERAL",
    time: "10 OCT",
    title: "Ventana de mantenimiento",
    body: "Este fin de semana hay mantenimiento programado del sistema. Puede haber interrupciones breves.",
    dot: "none",
    labelColor: "text-[#cfc4c5]",
    titleHover: "group-hover:text-[#c6c6c6]",
    itemClass: "opacity-50 hover:opacity-100",
  },
];

function Dot({ kind }: { kind: Notif["dot"] }) {
  const base = "mt-2 w-2 h-2 rounded-full shrink-0";
  switch (kind) {
    case "unread":
      return <div className={`${base} bg-[#e5e2e1]`} />;
    case "hover":
      return (
        <div
          className={`${base} bg-[#e5e2e1] opacity-0 group-hover:opacity-100 transition-opacity`}
        />
      );
    case "error":
      return <div className={`${base} bg-[#ffb4ab]`} />;
    default:
      return <div className={`${base} bg-transparent`} />;
  }
}

export default function NotificacionesPage() {
  return (
    <div className="max-w-[1440px] mx-auto w-full px-6 md:px-20 py-40 grid grid-cols-12 gap-8 relative">
      {/* Header */}
      <header className="col-span-12 mb-12 border-b border-[#353535] pb-6">
        <h1 className="font-[family-name:var(--font-syne)] text-[120px] font-extrabold leading-[1.1] tracking-[-0.04em] text-[#e5e2e1]">
          NOTIFICACIONES
        </h1>
      </header>

      {/* Notification List Area */}
      <div className="col-span-12 md:col-span-8 lg:col-span-6 md:col-start-3 lg:col-start-4">
        <div className="flex flex-col">
          {NOTIFS.map((n) => (
            <div
              key={n.title}
              className={`group relative py-6 border-b border-[#353535] hover:border-[#4c4546] transition-colors duration-150 cursor-pointer flex items-start gap-4 ${n.itemClass ?? ""}`}
            >
              <Dot kind={n.dot} />
              <div className="flex-1">
                <div className="flex justify-between items-baseline mb-2">
                  <span className={`label-tech text-[12px] ${n.labelColor}`}>
                    {n.label}
                  </span>
                  <span className="label-tech text-[12px] text-[#4c4546]">
                    {n.time}
                  </span>
                </div>
                <h2
                  className={`font-[family-name:var(--font-syne)] text-[32px] font-semibold leading-[1.2] tracking-[-0.01em] text-[#e5e2e1] transition-colors ${n.titleHover}`}
                >
                  {n.title}
                </h2>
                <p className="mt-2 text-[16px] leading-[1.6] text-[#cfc4c5] max-w-[448px]">
                  {n.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 flex justify-end">
          <button
            type="button"
            className="bg-[#e5e2e1] text-[#131313] py-3 px-6 label-tech text-[12px] hover:bg-transparent hover:text-[#e5e2e1] hover:border-[#e5e2e1] border border-transparent transition-all duration-150"
          >
            Marcar todas como leídas
          </button>
        </div>
      </div>
    </div>
  );
}
