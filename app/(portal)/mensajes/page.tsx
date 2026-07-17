/**
 * Mensajería Directa (porteo FIEL de "LABURO - Messaging" de Stitch). Layout de
 * chat a 2 columnas: lista de conversaciones (aside) + hilo activo (header +
 * mensajes + input), con un context header arriba (evento "Festival Sur • Live").
 * Estilos exactos de Stitch traducidos a valores arbitrarios; radio 0px salvo
 * círculos/avatares (estilo de la casa LABURO). Íconos lucide-react en lugar de
 * Material Symbols. Copy tal cual (inglés del diseño original, se ajusta después).
 * Datos estáticos del HTML de Stitch, sin Supabase. El layout del portal ya pone
 * sidebar + <main md:pl-[280px]>; esta page devuelve SOLO el contenido.
 */

import { Search, Bell, MoreVertical, Users, CheckCheck, Paperclip, Send } from "lucide-react";

// Geist técnico SIN uppercase forzado (font-label-sm de Stitch: Geist 500 +
// tracking 0.1em, sin text-transform). No usamos label-tech porque mayusculiza.
const LABEL = "font-[family-name:var(--font-geist)] text-[12px] font-medium tracking-[0.1em]";

interface Thread {
  name: string;
  time: string;
  preview: string;
  active?: boolean;
  unread?: boolean;
  avatar?: string; // si falta → ícono de grupo
}

const THREADS: Thread[] = [
  {
    name: "Elena Rostova",
    time: "10:42 AM",
    preview: "Hay que ajustar las luces del Escenario B.",
    active: true,
    unread: true,
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCnnlY7QTGkQfeYyagglt4ugDMpchZaS08_n_IEO8NwiJ8khZCjDJpk-trums2a8YL8MrftzhMo6z2oCvx3zLmgAAOgKt_cELEMtKjCw7x3jkWsMFaJ0gdEXpfrv1RUt8R0M8HNGFgiaT_pJVOFmhkoyZSluwASKbobeuUvAx46YaZQxBFCBCpUjE2uBsoX1DY7UoDQfIn3VvhgXENXxkWN-Ch4c5yc3OKQC5o4RomEI00IpAW_YHaf_R5LRWqpbJm7dsQyeaLZ_GM",
  },
  {
    name: "Marcus Vance",
    time: "Ayer",
    preview: "Prueba de sonido lista para el acto principal.",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDOsQvZ0wW9fkz91hos3akJjV1MuF6-8c20gd5eGmYMFv1qWO0ytvSkTZr-Qr1cIOl4X4ZVSk2iqBJ2qWMuQdEv8KNjH2IAMtxyPfrKoAXjjmRF_WHPagxBqAYFs1jhUhtJ3oS8Xn5T3YOHiqn1H6fJFME7BPdtYxNuA7BqUF6pGiNEQKskMz0o2mGHaGRY_JtUjcLV8GU0vaTMDCNc3e_t7WFFzrIws0Uv4-2MztNsxjgQzwiuWrRETDfhshuevPthIb5TgRKTalk",
  },
  {
    name: "Security Team Alpha",
    time: "Lun",
    preview: "Todos los accesos asegurados.",
  },
];

const AVATAR_ELENA =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCNlTIWByBDm65vFwZ01pnvTnrxLTMzmKxjNGVUdx0e5NoorCEePa8dTdpfv-I9Cj7JmOlYDcoqBuRq6_KbEPhR3u7Y6B72LqVYQusAaPeE24FQb97RTzbaTRaa6RQnirXn_TlmckkaueMlJaY4u0bnRrJU_79ig2exlnxxFODLC3n1D5FAgCLbui8zrGVfO1Ks2u3bIeA0vEYBesB9OCBxwpXAUMDI6z0Se_L047ioxC22oBPpACTkvSDhOHHECY9puOqA3vARDsI";

const AVATAR_MSG_1 =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDXyBMIISVaQFUHQJ4BuozrHax6CwE-R0HZAanXwgSdhm-vjOtghmvAP4oEBPp1BWEqPKcixagvW7Jqi_o3WdfeKE1w0HyGMV8LoSX5V-K2BBUgo5UfmnMlpAU1UcGh3xPoXUwUaJxyNz8z1QxziDYiru_LLB3AUUtB0i1CdU-jvl_HlbXAnEGFt1zqNAEzdw8ohpoGKf1yy20Unr_gzoQiZe2SSjLvCa8A24QaW-qmoI6zadIjK_rM4CH07zZUi7uFjW2ETYb2DQM";

const AVATAR_MSG_2 =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBUX_eXWeSLc-h5lN2ZECg6MxzucL-WxkZ7kTfzJwX-tktqf6LeYy6pn15_oDRHGDzJKxWp_odawBI7D4tTlL31-XWH2hvC6t1nKqgM7TE2pWp7N7Ig9Q0OGONPV0gPLGRKh8giOu0skFdB_DPsbeSpdiEiUxPiVexChlPJ4ghVv44loYALwTsWK617CtbtJ5xXgQWyZhrF7v4htWQsNZHsKOqoqB2Zw7clvvh-QlP0BnlE63PxrbaOg_GVN8WV4w-fopnDEPJYXM4";

export default function MensajesPage() {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#131313]">
      {/* Context Header */}
      <header className="flex justify-between items-center px-6 py-4 w-full h-16 shrink-0 bg-[#131313]/80 backdrop-blur-xl border-b border-[#1A1A1A] z-30">
        <div className="flex items-center gap-4">
          <h2 className="font-[family-name:var(--font-syne)] text-[24px] font-semibold text-[#c6c6c6] m-0">
            Festival Sur
          </h2>
          <span className={`${LABEL} px-2 py-1 border border-[#4c4546] text-[#cfc4c5]`}>
            En vivo
          </span>
        </div>
        <div className="flex gap-4">
          <button
            type="button"
            className="text-[#c6c6c6] hover:bg-white/5 transition-colors p-2 rounded-full"
            aria-label="Notifications"
          >
            <Bell size={22} />
          </button>
        </div>
      </header>

      {/* Chat Interface */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Conversations List */}
        <aside className="w-full md:w-80 shrink-0 border-r border-[#4c4546]/30 flex flex-col bg-[#0e0e0e]">
          <div className="p-4 border-b border-[#4c4546]/30">
            <div className="relative">
              <Search
                size={20}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#cfc4c5]"
              />
              <input
                type="text"
                placeholder="Buscar conversaciones..."
                className="w-full bg-[#20201f] pl-10 pr-4 py-2 border-none text-[16px] text-[#e5e2e1] focus:ring-1 focus:ring-[#c6c6c6] focus:outline-none placeholder:text-[#cfc4c5]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
            {THREADS.map((t) => (
              <button
                key={t.name}
                type="button"
                className={`w-full text-left p-3 transition-colors flex gap-3 items-start relative ${
                  t.active
                    ? "bg-[#2a2a2a] border border-[#4c4546]/50"
                    : "border border-transparent hover:bg-[#20201f]"
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-[#353535] flex items-center justify-center shrink-0 overflow-hidden border border-[#4c4546]">
                  {t.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.avatar} alt={t.name} className="w-full h-full object-cover" />
                  ) : (
                    <Users size={20} className="text-[#cfc4c5]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3
                      className={`text-[16px] font-semibold truncate ${
                        t.active ? "text-[#c6c6c6]" : "text-[#e5e2e1]"
                      }`}
                    >
                      {t.name}
                    </h3>
                    <span className={`${LABEL} text-[#cfc4c5] shrink-0`}>{t.time}</span>
                  </div>
                  <p className="text-[14px] text-[#cfc4c5] truncate">{t.preview}</p>
                </div>
                {t.unread && (
                  <span className="w-2 h-2 rounded-full bg-[#b9c3ff] absolute top-4 right-3" />
                )}
              </button>
            ))}
          </div>
        </aside>

        {/* Active Chat */}
        <section className="flex-1 flex flex-col min-w-0 bg-[#131313]">
          {/* Chat Header */}
          <div className="p-4 border-b border-[#4c4546]/30 flex justify-between items-center bg-[#0e0e0e] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden border border-[#4c4546] shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={AVATAR_ELENA} alt="Elena Rostova" className="w-full h-full object-cover" />
              </div>
              <div>
                <h2 className="text-[18px] font-semibold text-[#c6c6c6]">Elena Rostova</h2>
                <p className={`${LABEL} text-[#cfc4c5]`}>Coordinadora del Evento • Festival Sur</p>
              </div>
            </div>
            <button
              type="button"
              className="p-2 text-[#cfc4c5] hover:text-[#c6c6c6] transition-colors"
              aria-label="More options"
            >
              <MoreVertical size={22} />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8 min-h-0">
            {/* Date Divider */}
            <div className="flex justify-center">
              <span
                className={`${LABEL} text-[#cfc4c5] px-3 py-1 bg-[#1c1b1b] border border-[#4c4546]/30`}
              >
                Hoy
              </span>
            </div>

            {/* Received Message */}
            <div className="flex gap-4 max-w-[80%]">
              <div className="w-8 h-8 rounded-full overflow-hidden border border-[#4c4546] shrink-0 mt-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={AVATAR_MSG_1} alt="Elena Rostova" className="w-full h-full object-cover" />
              </div>
              <div className="space-y-2">
                <div className="bg-[#353535] border border-[#4c4546]/50 p-4 shadow-sm">
                  <p className="text-[16px] leading-[1.6] text-[#e5e2e1]">
                    El rig de luces del Escenario B está tirando sombras cerca de la tarima de la
                    batería. ¿Podemos mandar a alguien a ajustar los focos antes de las 14:00?
                  </p>
                </div>
                <span className={`${LABEL} text-[#cfc4c5] block ml-1`}>10:40 AM</span>
              </div>
            </div>

            {/* Sent Message */}
            <div className="flex gap-4 max-w-[80%] ml-auto justify-end">
              <div className="space-y-2 flex flex-col items-end">
                <div className="bg-[#c6c6c6] text-[#303030] p-4 shadow-sm">
                  <p className="text-[16px] leading-[1.6]">Voy. Te mando a Marco ahora.</p>
                </div>
                <div className="flex items-center gap-1 mr-1">
                  <span className={`${LABEL} text-[#cfc4c5]`}>10:45 AM</span>
                  <CheckCheck size={16} className="text-[#b9c3ff]" />
                </div>
              </div>
            </div>

            {/* Received Message (Current Focus) */}
            <div className="flex gap-4 max-w-[80%]">
              <div className="w-8 h-8 rounded-full overflow-hidden border border-[#4c4546] shrink-0 mt-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={AVATAR_MSG_2} alt="Elena Rostova" className="w-full h-full object-cover" />
              </div>
              <div className="space-y-2">
                <div className="bg-[#353535] border border-[#4c4546]/50 p-4 shadow-sm">
                  <p className="text-[16px] leading-[1.6] text-[#e5e2e1]">
                    Gracias. Aparte, ¿confirmás que el horario de ingreso de proveedores para mañana
                    sigue igual?
                  </p>
                </div>
                <span className={`${LABEL} text-[#cfc4c5] block ml-1`}>10:48 AM</span>
              </div>
            </div>
          </div>

          {/* Input Area */}
          <div className="p-4 bg-[#0e0e0e] border-t border-[#4c4546]/30 shrink-0">
            <div className="flex items-end gap-3 max-w-4xl mx-auto">
              <button
                type="button"
                className="p-3 text-[#cfc4c5] hover:text-[#c6c6c6] transition-colors shrink-0"
                aria-label="Attach file"
              >
                <Paperclip size={22} />
              </button>
              <div className="flex-1 bg-[#20201f] border border-[#4c4546]/50 overflow-hidden focus-within:border-[#c6c6c6] transition-colors">
                <textarea
                  rows={1}
                  placeholder="Escribí un mensaje..."
                  style={{ minHeight: "48px" }}
                  className="w-full bg-transparent border-none p-3 text-[16px] text-[#e5e2e1] focus:ring-0 resize-none max-h-32"
                />
              </div>
              <button
                type="button"
                className="p-3 bg-[#c6c6c6] text-[#303030] hover:bg-white transition-colors shrink-0 flex items-center justify-center"
                aria-label="Send"
              >
                <Send size={22} fill="currentColor" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
