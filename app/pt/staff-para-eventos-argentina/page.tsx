import type { Metadata } from "next";
import Link from "next/link";
import { BLOG_ORIGIN } from "@/lib/blog";
import { waLink } from "@/lib/blog-i18n";
import { BlogFooterIntl, BlogHeaderIntl } from "../../blog/_intl/chrome-intl";
import { WRAP } from "../../blog/chrome";
import { Faq } from "../../blog/faq";

/**
 * Staff para eventos na Argentina (27/11/2026, frente LABURO del plan Número 1).
 *
 * Par en portugués de /en/event-staffing-argentina y de /para/personal-para-eventos
 * (hreflang entre las tres). La busca el expositor o la marca de Brasil que tiene
 * un estande, un congreso o una activación en Buenos Aires y no tiene equipo acá.
 *
 * Mismas reglas que la de inglés: LABURO no contrata ni emplea, la app es solo en
 * castellano, por eso el pedido va a WhatsApp con el texto en portugués. Los números
 * de fichas son los de la página en castellano (octubre de 2026): no inventar otros.
 */

const URL = `${BLOG_ORIGIN}/pt/staff-para-eventos-argentina`;
const URL_ES = `${BLOG_ORIGIN}/para/personal-para-eventos`;
const URL_EN = `${BLOG_ORIGIN}/en/event-staffing-argentina`;
const TITULO = "Staff para eventos na Argentina";
const META_TITULO = "Staff para Eventos na Argentina: Buenos Aires e Outras Cidades | LABURO";
const DESCRIPCION =
  "Staff para eventos na Argentina para feiras, congressos e ativações de marca: recepcionistas, promotoras, credenciamento, bar e montagem em Buenos Aires e outras cidades.";
const WA = "Olá! Preciso de staff para um evento na Argentina. Evento: ___ Cidade: ___ Datas: ___ Funções e quantidade: ___";

const FAQS = [
  {
    q: "Como funciona a contratação de staff para eventos na Argentina pelo LABURO?",
    a: "O LABURO é a plataforma de staff para eventos da SOMOS DER, produtora de eventos de Buenos Aires. O aplicativo está só em espanhol, então quem organiza do Brasil escreve pelo WhatsApp ou por e-mail com a cidade, as datas e a quantidade de pessoas por função. A equipe do LABURO publica as vagas para as pessoas daquela região, cada uma recebe a oferta com pagamento, horário e condições, e aceita pelo celular.",
  },
  {
    q: "Dá para ter recepcionistas que falam português numa feira em Buenos Aires?",
    a: "Sim, isso se pede na função. Recepcionistas, hostess e equipe de credenciamento que trabalham em feiras e congressos com público internacional costumam falar inglês e, às vezes, português. O que pedimos é que a pessoa saiba orientar e responder uma pergunta, não um idioma perfeito. Para interpretação simultânea você precisa de intérpretes profissionais, que é outro perfil.",
  },
  {
    q: "Em quais cidades da Argentina tem staff para eventos?",
    a: "São mais de 1.200 perfis de pessoas que trabalham em eventos no país. A maioria está em Buenos Aires: mais de 170 na Cidade e mais de 300 na Província. Fora da Grande Buenos Aires, as cidades com mais gente são Posadas (mais de 100 perfis) e Bariloche (cerca de 100), seguidas de Catamarca, Bahía Blanca, Rosario e Formosa, com 20 a 35 cada uma. Dados de outubro de 2026.",
  },
  {
    q: "O LABURO é uma agência de staff?",
    a: "Não. O LABURO é uma plataforma gratuita onde se publicam vagas e onde as pessoas que trabalham em eventos mantêm o seu perfil. Nem o LABURO nem a SOMOS DER empregam o staff: quem monta a equipe escolhe, contrata e paga cada pessoa diretamente. Se você prefere que uma única empresa cuide do evento inteiro, staff incluído, isso é produção de eventos, e a SOMOS DER faz.",
  },
  {
    q: "Quanto custa o staff para eventos na Argentina?",
    a: "Usar o LABURO é grátis para os dois lados; o pagamento de cada pessoa é definido por quem contrata e fica escrito na oferta. Depende da função, das horas, da cidade e da data. Como se monta o orçamento de uma equipe está no nosso guia sobre quanto custa contratar equipe para um evento.",
  },
  {
    q: "Com quanta antecedência devo reservar o staff?",
    a: "Assim que tiver as datas e as funções. Para porta, credenciamento, recepção e produção há bastante gente em Buenos Aires; para bar, cozinha e técnica há menos, então reserve essas primeiro. Dezembro é o mês com mais eventos do ano na Argentina.",
  },
];

export const metadata: Metadata = {
  title: { absolute: META_TITULO },
  description: DESCRIPCION,
  alternates: {
    canonical: URL,
    languages: { "es-AR": URL_ES, en: URL_EN, "pt-BR": URL, "x-default": URL_ES },
  },
  openGraph: {
    type: "website",
    url: URL,
    siteName: "LABURO",
    locale: "pt_BR",
    title: META_TITULO,
    description: DESCRIPCION,
  },
  twitter: { card: "summary_large_image", title: META_TITULO, description: DESCRIPCION },
};

const BOTON =
  "inline-flex items-center justify-center bg-[#f5f5f5] text-black px-9 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:bg-[#0047ff] hover:text-white transition-colors duration-300";
const BOTON_2 =
  "inline-flex items-center justify-center border border-[#f5f5f5] text-[#f5f5f5] px-9 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:border-[#0047ff] hover:text-[#0047ff] transition-colors duration-300";
const MAIL = "mailto:contacto@somosder.ar?subject=Staff%20para%20evento%20na%20Argentina";

const FUNCOES: [string, string, string, string][] = [
  ["Feiras e exposições", "Recepcionistas de estande, promotoras, credenciamento, montagem e desmontagem", "Equipe para um estande em feira", "/pt/blog/equipe-para-estande-em-feira"],
  ["Congressos e convenções", "Credenciamento, apoio de sala, recepção e orientação, mensageiros, intérpretes", "Equipe para um congresso ou convenção", "/pt/blog/equipe-para-congresso-ou-convencao"],
  ["Ativações e lançamentos", "Promotoras, embaixadores de marca, degustação, apresentadores", "O briefing para promotoras", "/pt/blog/briefing-para-promotoras-de-ativacao"],
  ["Eventos corporativos", "Hostess e recepção, chapelaria, garçons, bartenders", "Hostess e recepção em eventos corporativos", "/pt/blog/hostess-e-recepcao-em-eventos-corporativos"],
  ["Porta e credenciamento", "Controle de acesso, credenciamento, leitura de QR, pulseiras e crachás", "O que faz um credenciador", "/pt/blog/credenciamento-em-congresso-o-que-faz"],
  ["Produção e técnica", "Assistentes de produção, montadores, técnicos de som, luz e LED", "O que faz um stage manager", "/pt/blog/o-que-faz-um-stage-manager"],
];

export default function StaffParaEventosArgentina() {
  const organizacion = {
    "@type": "Organization",
    "@id": `${BLOG_ORIGIN}/#organization`,
    name: "LABURO",
    url: BLOG_ORIGIN,
    parentOrganization: { "@id": "https://www.somosder.ar/#organization", name: "SOMOS DER" },
  };
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": URL,
      url: URL,
      name: TITULO,
      description: DESCRIPCION,
      inLanguage: "pt-BR",
      dateModified: "2026-11-27",
      isPartOf: { "@type": "WebSite", "@id": `${BLOG_ORIGIN}/#website`, url: BLOG_ORIGIN, name: "LABURO" },
      publisher: organizacion,
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: TITULO,
      serviceType: "Staff para eventos",
      description: DESCRIPCION,
      areaServed: { "@type": "Country", name: "Argentina" },
      provider: organizacion,
      url: URL,
      availableLanguage: ["pt", "es", "en"],
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: BLOG_ORIGIN },
        { "@type": "ListItem", position: 2, name: TITULO, item: URL },
      ],
    },
  ];

  const h2 = "font-[family-name:var(--font-syne)] font-bold uppercase tracking-tight leading-[1.1] text-[clamp(24px,3.4vw,36px)] mt-16 first:mt-0";
  const p = "text-[17px] leading-[1.75] text-[#c8c8c8] mt-6";
  const a = "text-[#f5f5f5] underline underline-offset-4 hover:text-[#0047ff] transition-colors";

  return (
    <div lang="pt-BR" className="min-h-dvh bg-black text-[#f5f5f5] selection:bg-[#0047ff] selection:text-white flex flex-col">
      <BlogHeaderIntl lang="pt" />

      <main className="flex-1">
        <section className="border-b border-[#1a1a1a]">
          <div className={`${WRAP} py-16 md:py-24`}>
            <div className="max-w-[900px]">
              <span className="label-tech text-[11px] tracking-[0.3em] text-[#0047ff] block">
                Para marcas, expositores e organizadores
              </span>
              <h1 className="font-[family-name:var(--font-syne)] font-extrabold uppercase tracking-tight leading-[1.05] text-[clamp(34px,6vw,72px)] break-words mt-5">
                {TITULO}
              </h1>
              <p className="text-[17px] md:text-[19px] leading-[1.7] text-[#8a8a8a] mt-8 max-w-[680px]">
                Staff para eventos na Argentina para marcas e expositores que não têm equipe aqui: recepcionistas,
                promotoras, credenciamento, bar e montagem para feiras, congressos e ativações em Buenos Aires e
                outras cidades. Mande a cidade, as datas e as funções, e respondemos em português.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mt-10">
                <a href={waLink(WA)} target="_blank" rel="noopener" className={BOTON} data-cta="wa-staff-pt-top">
                  Falar no WhatsApp
                </a>
                <a href={MAIL} className={BOTON_2} data-cta="mail-staff-pt-top">
                  contacto@somosder.ar
                </a>
              </div>
            </div>
          </div>
        </section>

        <div className={WRAP}>
          <div className="max-w-[760px] py-16 md:py-24">
            <h2 className={h2}>Funções de staff para eventos que cobrimos</h2>
            <p className={p}>
              O staff se pede por função, não como &ldquo;equipe&rdquo; em geral. Estas são as funções do catálogo do
              LABURO, agrupadas pelo tipo de evento que costuma pedir cada uma:
            </p>
            <div className="mt-8 border border-[#1a1a1a]">
              {FUNCOES.map(([tipo, funcoes, guia, href], i) => (
                <div key={tipo} className={`p-6 md:p-8 ${i > 0 ? "border-t border-[#1a1a1a]" : ""}`}>
                  <h3 className="font-[family-name:var(--font-syne)] font-bold uppercase tracking-tight text-[18px]">{tipo}</h3>
                  <p className="text-[16px] leading-[1.65] text-[#c8c8c8] mt-3">{funcoes}</p>
                  <Link href={href} className={`${a} text-[14px] mt-3 inline-block`}>
                    Guia: {guia}
                  </Link>
                </div>
              ))}
            </div>

            <h2 className={h2}>Recepcionistas que falam português</h2>
            <p className={p}>
              Se o seu estande ou o seu congresso recebe público do Brasil, peça o idioma na função. Quem trabalha
              em recepção, credenciamento e estandes de eventos internacionais em Buenos Aires costuma falar inglês
              e, às vezes, português. Pedimos que saiba orientar e resolver, não um idioma perfeito. Interpretação
              simultânea é outro perfil: veja{" "}
              <Link href="/pt/blog/interpretes-e-tradutores-em-congresso" className={a}>
                intérpretes e tradutores num congresso
              </Link>
              .
            </p>

            <h2 className={h2}>Staff em Buenos Aires e no resto da Argentina</h2>
            <p className={p}>
              São mais de 1.200 perfis de pessoas que trabalham em eventos no país, a maioria em Buenos Aires (mais
              de 170 na Cidade e mais de 300 na Província). Fora da Grande Buenos Aires, onde há mais gente é em
              Posadas e Bariloche, seguidas de Catamarca, Bahía Blanca, Rosario e Formosa. Dados de outubro de 2026.
              Se numa cidade há pouca gente, avisamos antes de você planejar contando com ela.
            </p>

            <h2 className={h2}>Como contratar staff do Brasil</h2>
            <ol className="list-decimal pl-6 mt-6 space-y-3 text-[17px] leading-[1.75] text-[#c8c8c8]">
              <li>Mande a cidade, o local se já tiver, as datas e a quantidade de pessoas por função.</li>
              <li>Diga o que cada função precisa: idiomas, roupa, horário, refeições e como e quando se paga.</li>
              <li>Publicamos cada vaga para as pessoas daquela região e você vê quem se candidata.</li>
              <li>Cada pessoa escolhida recebe a oferta com pagamento e horário e aceita pelo celular.</li>
            </ol>
            <p className={p}>
              Nem o LABURO nem a SOMOS DER empregam o staff: você contrata e paga cada pessoa diretamente. Para
              fazer as contas antes, leia{" "}
              <Link href="/pt/blog/quantas-pessoas-de-equipe-para-um-evento" className={a}>
                quantas pessoas de equipe você precisa
              </Link>
              ,{" "}
              <Link href="/pt/blog/quanto-custa-contratar-equipe-para-evento" className={a}>
                quanto custa contratar equipe para um evento
              </Link>{" "}
              e{" "}
              <Link href="/pt/blog/antes-de-contratar-equipe-para-evento" className={a}>
                o que verificar antes de contratar
              </Link>
              .
            </p>

            <h2 className={h2}>O resto do seu evento na Argentina</h2>
            <p className={p}>
              Se prefere que uma única empresa cuide de tudo, staff incluído, isso é produção de eventos: a{" "}
              <a href="https://somosder.com/pt" className={a}>
                SOMOS DER
              </a>{" "}
              produz{" "}
              <a href="https://somosder.com/pt/feiras-estandes-expositores-argentina" className={a}>
                estandes para expositores
              </a>
              ,{" "}
              <a href="https://somosder.com/pt/producao-congressos-convencoes-argentina" className={a}>
                congressos e convenções
              </a>{" "}
              e{" "}
              <a href="https://somosder.com/pt/ativacoes-de-marca-argentina" className={a}>
                ativações de marca
              </a>{" "}
              na Argentina, e trabalha com{" "}
              <a href="https://somosder.com/pt/agencias-do-brasil-eventos-na-argentina" className={a}>
                agências do Brasil que fazem eventos aqui
              </a>
              . Para o credenciamento e a impressão de crachás na entrada existe o{" "}
              <a href="https://pase.somosder.ar/pt" className={a}>
                PASE, nosso sistema de credenciamento
              </a>
              . E se você tem um negócio de eventos e precisa de site ou marketing, isso é a{" "}
              <a href="https://hito.agency/pt/" className={a}>
                HITO
              </a>
              .
            </p>
            <p className={p}>
              Também em{" "}
              <Link href="/para/personal-para-eventos" hrefLang="es" className={a}>
                espanhol
              </Link>{" "}
              e em{" "}
              <Link href="/en/event-staffing-argentina" hrefLang="en" className={a}>
                inglês
              </Link>
              .
            </p>
          </div>
        </div>

        <Faq faqs={FAQS} eyebrow="Perguntas" titulo="O que mais nos perguntam." />

        <section className="border-t border-[#1a1a1a] bg-[#050505]">
          <div className={`${WRAP} py-20 md:py-28`}>
            <span className="label-tech text-[11px] tracking-[0.3em] text-[#0047ff] block">LABURO · da SOMOS DER</span>
            <h2 className="font-[family-name:var(--font-syne)] font-bold uppercase tracking-tighter text-[clamp(32px,6vw,72px)] leading-none mt-4">
              Sua equipe na Argentina.
            </h2>
            <p className="text-[16px] md:text-[18px] leading-[1.7] text-[#8a8a8a] max-w-[560px] mt-8">
              Mande a cidade, as datas e as funções. Respondemos em português em até um dia útil (horário de
              Buenos Aires).
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-10">
              <a href={waLink(WA)} target="_blank" rel="noopener" className={BOTON} data-cta="wa-staff-pt-bottom">
                Falar no WhatsApp
              </a>
              <a href={MAIL} className={BOTON_2} data-cta="mail-staff-pt-bottom">
                Mandar e-mail
              </a>
            </div>
          </div>
        </section>
      </main>

      <BlogFooterIntl lang="pt" />

      <div className="h-[76px] md:hidden" aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-0 z-40 md:hidden border-t border-[#1a1a1a] bg-black/95 backdrop-blur px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <a
          href={waLink(WA)}
          target="_blank"
          rel="noopener"
          className="flex w-full items-center justify-center bg-[#f5f5f5] text-black px-6 py-3.5 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest active:bg-[#0047ff] active:text-white"
        >
          Falar no WhatsApp
        </a>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    </div>
  );
}
