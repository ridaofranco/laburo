/**
 * Textos fijos del blog en los idiomas de traducción (06/11/2026).
 *
 * El blog en español sigue con sus textos de siempre (app/blog/*). Esto es solo
 * para /en, /pt, /fr e /it: header, cierre, FAQ y migas. LABURO opera en
 * Argentina y la app (registro, portal) es solo en castellano, así que el cierre
 * de las notas traducidas NO manda a /sumate ni a /registrar-productora: manda a
 * WhatsApp con el texto ya escrito en ese idioma, como las notas de somosder.ar.
 */
import type { IdiomaTraduccion } from "./blog";

export const WA_NUMERO = "5491171540675";

export function waLink(texto: string): string {
  return `https://wa.me/${WA_NUMERO}?text=${encodeURIComponent(texto)}`;
}

export type TextosBlog = {
  locale: string;
  nombreIdioma: string;
  inicio: string;
  blog: string;
  indiceTitulo: string;
  indiceDescripcion: string;
  indiceEyebrow: string;
  indiceH1: [string, string];
  indiceBajada: string;
  lectura: string;
  por: string;
  faqEyebrow: string;
  faqTitulo: string;
  seguirLeyendo: string;
  enEspanol: string;
  enEspanolBajada: string;
  ctaTitulo: [string, string];
  ctaTexto: string;
  ctaBoton: string;
  ctaWa: string;
  pie: string;
};

export const TEXTOS: Record<IdiomaTraduccion, TextosBlog> = {
  en: {
    locale: "en_US",
    nombreIdioma: "English",
    inicio: "Home",
    blog: "Blog",
    indiceTitulo: "LABURO blog. Event staffing guides",
    indiceDescripcion:
      "Practical guides to plan and staff an event, hire temporary event staff and work at events, written from the real operations of SOMOS DER in Argentina.",
    indiceEyebrow: "Blog // Event staffing",
    indiceH1: ["How a team", "comes together."],
    indiceBajada:
      "What we learned staffing our own events, in short guides: which roles you need, how many people, what to check before confirming someone and what the job looks like from the other side.",
    lectura: "read",
    por: "By SOMOS DER",
    faqEyebrow: "FAQ",
    faqTitulo: "What people ask us most.",
    seguirLeyendo: "Keep reading",
    enEspanol: "More guides in Spanish",
    enEspanolBajada: "The full LABURO blog, with more than 90 guides, is in Spanish.",
    ctaTitulo: ["Real staff,", "for your event."],
    ctaTexto:
      "LABURO is the event staffing platform built by SOMOS DER, an event production company in Buenos Aires, Argentina. If you are planning an event in Argentina or want to know how it works, write to us.",
    ctaBoton: "Write to us on WhatsApp",
    ctaWa: "Hi! I read the LABURO blog and I'd like to know more about staffing for an event.",
    pie: "© 2026 LABURO · SOMOS DER. All rights reserved.",
  },
  pt: {
    locale: "pt_BR",
    nombreIdioma: "Português",
    inicio: "Início",
    blog: "Blog",
    indiceTitulo: "Blog do LABURO. Equipe para eventos",
    indiceDescripcion:
      "Guias práticos para dimensionar e montar a equipe de um evento, contratar staff temporário e trabalhar em eventos, escritos a partir da operação real da SOMOS DER.",
    indiceEyebrow: "Blog // Equipe para eventos",
    indiceH1: ["Como se monta", "uma equipe."],
    indiceBajada:
      "O que aprendemos montando a equipe das nossas próprias operações, em guias curtos: quais funções fazem falta, quantas pessoas, o que verificar antes de confirmar alguém e como é o trabalho do outro lado.",
    lectura: "de leitura",
    por: "Por SOMOS DER",
    faqEyebrow: "Perguntas frequentes",
    faqTitulo: "O que mais nos perguntam.",
    seguirLeyendo: "Continue lendo",
    enEspanol: "Mais guias em espanhol",
    enEspanolBajada: "O blog completo do LABURO, com mais de 90 guias, está em espanhol.",
    ctaTitulo: ["Equipe de verdade,", "para o seu evento."],
    ctaTexto:
      "O LABURO é a plataforma de staff para eventos criada pela SOMOS DER, produtora de eventos de Buenos Aires, Argentina. Se você está organizando um evento na Argentina ou quer saber como funciona, fale com a gente.",
    ctaBoton: "Falar pelo WhatsApp",
    ctaWa: "Olá! Li o blog do LABURO e quero saber mais sobre equipe para um evento.",
    pie: "© 2026 LABURO · SOMOS DER. Todos os direitos reservados.",
  },
  fr: {
    locale: "fr_FR",
    nombreIdioma: "Français",
    inicio: "Accueil",
    blog: "Blog",
    indiceTitulo: "Blog de LABURO. Personnel événementiel",
    indiceDescripcion:
      "Guides pratiques pour dimensionner le personnel d'un événement, recruter des extras et travailler dans l'événementiel, écrits depuis les opérations réelles de SOMOS DER.",
    indiceEyebrow: "Blog // Personnel événementiel",
    indiceH1: ["Comment on monte", "une équipe."],
    indiceBajada:
      "Ce que nous avons appris en montant les équipes de nos propres opérations, en guides courts : quels postes prévoir, combien de personnes, quoi vérifier avant de confirmer quelqu'un et à quoi ressemble le travail de l'autre côté.",
    lectura: "de lecture",
    por: "Par SOMOS DER",
    faqEyebrow: "Questions fréquentes",
    faqTitulo: "Ce qu'on nous demande le plus.",
    seguirLeyendo: "À lire aussi",
    enEspanol: "Plus de guides en espagnol",
    enEspanolBajada: "Le blog complet de LABURO, avec plus de 90 guides, est en espagnol.",
    ctaTitulo: ["Du vrai personnel,", "pour votre événement."],
    ctaTexto:
      "LABURO est la plateforme de personnel événementiel créée par SOMOS DER, agence de production d'événements à Buenos Aires, en Argentine. Si vous organisez un événement en Argentine ou voulez savoir comment ça marche, écrivez-nous.",
    ctaBoton: "Nous écrire sur WhatsApp",
    ctaWa: "Bonjour ! J'ai lu le blog de LABURO et j'aimerais en savoir plus sur le personnel pour un événement.",
    pie: "© 2026 LABURO · SOMOS DER. Tous droits réservés.",
  },
  it: {
    locale: "it_IT",
    nombreIdioma: "Italiano",
    inicio: "Home",
    blog: "Blog",
    indiceTitulo: "Blog di LABURO. Staff per eventi",
    indiceDescripcion:
      "Guide pratiche per dimensionare e organizzare lo staff di un evento, assumere personale temporaneo e lavorare negli eventi, scritte dall'operatività reale di SOMOS DER.",
    indiceEyebrow: "Blog // Staff per eventi",
    indiceH1: ["Come si costruisce", "una squadra."],
    indiceBajada:
      "Quello che abbiamo imparato organizzando lo staff delle nostre operazioni, in guide brevi: quali ruoli servono, quante persone, cosa verificare prima di confermare qualcuno e com'è il lavoro dall'altra parte.",
    lectura: "di lettura",
    por: "Di SOMOS DER",
    faqEyebrow: "Domande frequenti",
    faqTitulo: "Quello che ci chiedono di più.",
    seguirLeyendo: "Continua a leggere",
    enEspanol: "Altre guide in spagnolo",
    enEspanolBajada: "Il blog completo di LABURO, con più di 90 guide, è in spagnolo.",
    ctaTitulo: ["Staff vero,", "per il tuo evento."],
    ctaTexto:
      "LABURO è la piattaforma di staff per eventi creata da SOMOS DER, casa di produzione di eventi di Buenos Aires, Argentina. Se stai organizzando un evento in Argentina o vuoi sapere come funziona, scrivici.",
    ctaBoton: "Scrivici su WhatsApp",
    ctaWa: "Ciao! Ho letto il blog di LABURO e vorrei saperne di più sullo staff per un evento.",
    pie: "© 2026 LABURO · SOMOS DER. Tutti i diritti riservati.",
  },
};

/** Fecha larga en el idioma de la nota (UTC para que no corra un día). */
export function formatFecha(iso: string, locale: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale.replace("_", "-"), {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** Nombre corto de cada idioma para el selector (ES · EN · PT · FR · IT). */
export const ETIQUETA_IDIOMA: Record<string, string> = {
  es: "ES",
  en: "EN",
  pt: "PT",
  fr: "FR",
  it: "IT",
};
