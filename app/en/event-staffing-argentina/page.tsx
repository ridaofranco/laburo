import type { Metadata } from "next";
import Link from "next/link";
import { BLOG_ORIGIN } from "@/lib/blog";
import { waLink } from "@/lib/blog-i18n";
import { BlogFooterIntl, BlogHeaderIntl } from "../../blog/_intl/chrome-intl";
import { WRAP } from "../../blog/chrome";
import { Faq } from "../../blog/faq";

/**
 * Event staffing in Argentina (27/11/2026, frente LABURO del plan Número 1).
 *
 * La única página en inglés de LABURO para quien CONTRATA (el blog en inglés
 * son guías). La busca la marca o el expositor de afuera que tiene un evento,
 * un stand o una activación en Argentina y no tiene equipo acá. Google EE.UU.
 * nos ponía 5.º en «event staffing Argentina» con la portada de somosder.com
 * (26/11), sin una página propia.
 *
 * Mismas reglas que /para/personal-para-eventos (su par en castellano, con
 * hreflang recíproco): LABURO no contrata ni emplea, la app es solo en
 * castellano, por eso el pedido va a WhatsApp con el texto en inglés. Los
 * números de fichas son los de esa página (octubre de 2026): no inventar otros.
 */

const URL = `${BLOG_ORIGIN}/en/event-staffing-argentina`;
const URL_ES = `${BLOG_ORIGIN}/para/personal-para-eventos`;
const TITULO = "Event staffing in Argentina";
const META_TITULO = "Event Staffing in Argentina: Buenos Aires and Beyond | LABURO";
const DESCRIPCION =
  "Event staffing in Argentina for trade fairs, conferences and brand activations: hostesses, promo staff, registration, bar and setup crews in Buenos Aires and other cities.";
const WA = "Hi! I need event staffing in Argentina. Event: ___ City: ___ Dates: ___ Roles and headcount: ___";

const FAQS = [
  {
    q: "How does event staffing in Argentina work with LABURO?",
    a: "LABURO is the event staffing platform of SOMOS DER, an event production company based in Buenos Aires. The app is only in Spanish, so if you are organising from abroad you write to us on WhatsApp or by email with the city, the dates and the headcount by role. The LABURO team publishes the positions to the pool in that area, each person receives an offer with pay, hours and conditions, and accepts it from their phone.",
  },
  {
    q: "Can I get English-speaking staff for a trade fair or conference in Buenos Aires?",
    a: "Yes, you ask for it in the role. Hostesses, receptionists and registration staff who work conferences with international guests often speak English, and sometimes Portuguese. What we ask for is being able to give a clear direction and answer a question, not perfect English. For simultaneous interpreting you need professional interpreters, which is a separate profile.",
  },
  {
    q: "In which cities of Argentina is there event staff?",
    a: "There are more than 1,200 profiles of people who work at events across the country. Most are in Buenos Aires: more than 170 in the City and more than 300 in the Province. Outside the Buenos Aires metro area, the cities with the most people are Posadas (more than 100 profiles) and Bariloche (around 100), followed by Catamarca, Bahía Blanca, Rosario and Formosa, with 20 to 35 each. These are October 2026 figures.",
  },
  {
    q: "Is LABURO a staffing agency?",
    a: "No. LABURO is a free platform where positions are published and people who work at events keep their profiles. Neither LABURO nor SOMOS DER employs the staff: whoever books the team chooses, hires and pays each person directly. If you want a single company to run the whole event, staff included, that is event production, and SOMOS DER does it.",
  },
  {
    q: "How much does event staff cost in Argentina?",
    a: "Using LABURO is free for both sides; the pay for each person is set by whoever books and is written in the offer. It depends on the role, the hours, the city and the date. How a staff budget is put together is explained in our guide on how much event staff costs.",
  },
  {
    q: "How far in advance should I book event staff in Argentina?",
    a: "As early as you have the dates and the roles. Door, registration, reception and production roles have plenty of people in Buenos Aires; bar, kitchen and technical roles have fewer, so book those first. December is the busiest month of the year for events in Argentina.",
  },
];

export const metadata: Metadata = {
  title: { absolute: META_TITULO },
  description: DESCRIPCION,
  alternates: {
    canonical: URL,
    languages: { "es-AR": URL_ES, en: URL, "x-default": URL_ES },
  },
  openGraph: {
    type: "website",
    url: URL,
    siteName: "LABURO",
    locale: "en_US",
    title: META_TITULO,
    description: DESCRIPCION,
  },
  twitter: { card: "summary_large_image", title: META_TITULO, description: DESCRIPCION },
};

const BOTON =
  "inline-flex items-center justify-center bg-[#f5f5f5] text-black px-9 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:bg-[#0047ff] hover:text-white transition-colors duration-300";
const BOTON_2 =
  "inline-flex items-center justify-center border border-[#f5f5f5] text-[#f5f5f5] px-9 py-4 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest hover:border-[#0047ff] hover:text-[#0047ff] transition-colors duration-300";
const MAIL = "mailto:contacto@somosder.ar?subject=Event%20staffing%20in%20Argentina";

const ROLES: [string, string, string, string][] = [
  ["Trade fairs and exhibitions", "Booth hostesses, promo staff, receptionists, registration, setup and teardown", "Trade show booth staff", "/en/blog/trade-show-booth-staff"],
  ["Conferences and congresses", "Registration, room assistants, reception and wayfinding, runners, interpreters", "Conference and convention staff", "/en/blog/conference-and-convention-staff"],
  ["Brand activations and launches", "Promo staff, brand ambassadors, sampling, hosts", "The promo staff brief", "/en/blog/brand-activation-brief-for-promo-staff"],
  ["Corporate events", "Hostesses and reception, cloakroom, waiters, bartenders", "Corporate event hostess and reception", "/en/blog/corporate-event-hostess-and-reception"],
  ["Door and accreditation", "Access control, registration, scanner operators, wristbands and badges", "Conference registration staff", "/en/blog/conference-registration-staff-role"],
  ["Production and technical", "Production assistants, stagehands, sound, lighting and LED technicians", "What a stage manager does", "/en/blog/what-is-a-stage-manager-at-an-event"],
];

export default function EventStaffingArgentina() {
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
      inLanguage: "en",
      dateModified: "2026-11-27",
      isPartOf: { "@type": "WebSite", "@id": `${BLOG_ORIGIN}/#website`, url: BLOG_ORIGIN, name: "LABURO" },
      publisher: organizacion,
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: TITULO,
      serviceType: "Event staffing",
      description: DESCRIPCION,
      areaServed: { "@type": "Country", name: "Argentina" },
      provider: organizacion,
      url: URL,
      availableLanguage: ["en", "es"],
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: BLOG_ORIGIN },
        { "@type": "ListItem", position: 2, name: TITULO, item: URL },
      ],
    },
  ];

  const h2 = "font-[family-name:var(--font-syne)] font-bold uppercase tracking-tight leading-[1.1] text-[clamp(24px,3.4vw,36px)] mt-16 first:mt-0";
  const p = "text-[17px] leading-[1.75] text-[#c8c8c8] mt-6";
  const a = "text-[#f5f5f5] underline underline-offset-4 hover:text-[#0047ff] transition-colors";

  return (
    <div lang="en" className="min-h-dvh bg-black text-[#f5f5f5] selection:bg-[#0047ff] selection:text-white flex flex-col">
      <BlogHeaderIntl lang="en" />

      <main className="flex-1">
        <section className="border-b border-[#1a1a1a]">
          <div className={`${WRAP} py-16 md:py-24`}>
            <div className="max-w-[900px]">
              <span className="label-tech text-[11px] tracking-[0.3em] text-[#0047ff] block">
                For brands, exhibitors and organisers
              </span>
              <h1 className="font-[family-name:var(--font-syne)] font-extrabold uppercase tracking-tight leading-[1.05] text-[clamp(34px,6vw,72px)] break-words mt-5">
                {TITULO}
              </h1>
              <p className="text-[17px] md:text-[19px] leading-[1.7] text-[#8a8a8a] mt-8 max-w-[680px]">
                Event staffing in Argentina for brands and exhibitors who don&rsquo;t have a team here: hostesses,
                promo staff, registration, bar and setup crews for trade fairs, conferences and activations in
                Buenos Aires and other cities. Tell us the city, the dates and the roles, and we answer in English.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mt-10">
                <a href={waLink(WA)} target="_blank" rel="noopener" className={BOTON} data-cta="wa-event-staffing-top">
                  Ask on WhatsApp
                </a>
                <a href={MAIL} className={BOTON_2} data-cta="mail-event-staffing-top">
                  contacto@somosder.ar
                </a>
              </div>
            </div>
          </div>
        </section>

        <div className={WRAP}>
          <div className="max-w-[760px] py-16 md:py-24">
            <h2 className={h2}>Event staffing roles we cover</h2>
            <p className={p}>
              Staff is booked by role, not as &ldquo;staff&rdquo; in general. These are the roles in the LABURO
              catalogue, grouped by the type of event that usually asks for them:
            </p>
            <div className="mt-8 border border-[#1a1a1a]">
              {ROLES.map(([tipo, roles, guia, href], i) => (
                <div key={tipo} className={`p-6 md:p-8 ${i > 0 ? "border-t border-[#1a1a1a]" : ""}`}>
                  <h3 className="font-[family-name:var(--font-syne)] font-bold uppercase tracking-tight text-[18px]">{tipo}</h3>
                  <p className="text-[16px] leading-[1.65] text-[#c8c8c8] mt-3">{roles}</p>
                  <Link href={href} className={`${a} text-[14px] mt-3 inline-block`}>
                    Guide: {guia}
                  </Link>
                </div>
              ))}
            </div>

            <h2 className={h2}>Bilingual staff for trade fairs and conferences</h2>
            <p className={p}>
              If your stand or your conference has international visitors, ask for languages in the role. People
              who work reception, registration and booths at international events in Buenos Aires often speak
              English, and sometimes Portuguese. We ask for clear directions and good judgement, not perfect
              English. Simultaneous interpreting is a different profile: see{" "}
              <Link href="/en/blog/conference-interpreters-and-translators" className={a}>
                interpreters and translators for a conference
              </Link>
              .
            </p>

            <h2 className={h2}>Event staff in Buenos Aires and the rest of Argentina</h2>
            <p className={p}>
              There are more than 1,200 profiles of people who work at events across the country, most of them in
              Buenos Aires (more than 170 in the City and more than 300 in the Province). Outside the metro area,
              the largest pools are in Posadas and Bariloche, followed by Catamarca, Bahía Blanca, Rosario and
              Formosa. Figures from October 2026. Where the pool is small, we tell you before you plan around it.
            </p>

            <h2 className={h2}>How to book event staff from abroad</h2>
            <ol className="list-decimal pl-6 mt-6 space-y-3 text-[17px] leading-[1.75] text-[#c8c8c8]">
              <li>Send the city, the venue if you have it, the dates and the headcount for each role.</li>
              <li>Add what each role needs: languages, dress code, hours, meals and how and when people get paid.</li>
              <li>We publish each position to the people in that area and you see who applies.</li>
              <li>Each person you choose gets the offer with pay and hours and accepts it from their phone.</li>
            </ol>
            <p className={p}>
              Neither LABURO nor SOMOS DER employs the staff: you hire and pay each person directly. To work out
              numbers first, read{" "}
              <Link href="/en/blog/how-many-staff-for-an-event" className={a}>
                how many staff you need for an event
              </Link>
              ,{" "}
              <Link href="/en/blog/how-much-does-event-staff-cost" className={a}>
                how much event staff costs
              </Link>{" "}
              and{" "}
              <Link href="/en/blog/what-to-check-before-hiring-event-staff" className={a}>
                what to check before hiring
              </Link>
              .
            </p>

            <h2 className={h2}>The rest of your event in Argentina</h2>
            <p className={p}>
              If you would rather have one company run everything, staff included, that is event production:{" "}
              <a href="https://somosder.com/" className={a}>
                SOMOS DER
              </a>{" "}
              produces{" "}
              <a href="https://somosder.com/en/corporate-events-producer" className={a}>
                corporate events
              </a>
              ,{" "}
              <a href="https://somosder.com/en/conference-congress-production-argentina" className={a}>
                conferences
              </a>{" "}
              and{" "}
              <a href="https://somosder.com/en/brand-activations-argentina" className={a}>
                brand activations
              </a>{" "}
              in Argentina. For registration and badge printing at the door there is{" "}
              <a href="https://pase.somosder.ar/en" className={a}>
                PASE, our event check-in software
              </a>
              . And if you run an events business and need a website or marketing, that is{" "}
              <a href="https://hito.agency/en/" className={a}>
                HITO
              </a>
              .
            </p>
            <p className={p}>
              Reading Spanish?{" "}
              <Link href="/para/personal-para-eventos" hrefLang="es" className={a}>
                Personal para eventos
              </Link>{" "}
              has the same guide for organisers in Argentina.
            </p>
          </div>
        </div>

        <Faq faqs={FAQS} eyebrow="FAQ" titulo="What people ask us most." />

        <section className="border-t border-[#1a1a1a] bg-[#050505]">
          <div className={`${WRAP} py-20 md:py-28`}>
            <span className="label-tech text-[11px] tracking-[0.3em] text-[#0047ff] block">LABURO · by SOMOS DER</span>
            <h2 className="font-[family-name:var(--font-syne)] font-bold uppercase tracking-tighter text-[clamp(32px,6vw,72px)] leading-none mt-4">
              Your team in Argentina.
            </h2>
            <p className="text-[16px] md:text-[18px] leading-[1.7] text-[#8a8a8a] max-w-[560px] mt-8">
              Send the city, the dates and the roles. We reply in English within one business day (Buenos
              Aires time).
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-10">
              <a href={waLink(WA)} target="_blank" rel="noopener" className={BOTON} data-cta="wa-event-staffing-bottom">
                Ask on WhatsApp
              </a>
              <a href={MAIL} className={BOTON_2} data-cta="mail-event-staffing-bottom">
                Email us
              </a>
            </div>
          </div>
        </section>
      </main>

      <BlogFooterIntl lang="en" />

      <div className="h-[76px] md:hidden" aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-0 z-40 md:hidden border-t border-[#1a1a1a] bg-black/95 backdrop-blur px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <a
          href={waLink(WA)}
          target="_blank"
          rel="noopener"
          className="flex w-full items-center justify-center bg-[#f5f5f5] text-black px-6 py-3.5 font-[family-name:var(--font-syne)] font-bold text-[12px] uppercase tracking-widest active:bg-[#0047ff] active:text-white"
        >
          Ask on WhatsApp
        </a>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    </div>
  );
}
