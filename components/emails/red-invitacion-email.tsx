/**
 * Mail de INVITACIÓN A LA RED de proveedores y salones (0110, 14/11).
 *
 * Lo reciben los perfiles que armó SOMOS DER con los datos que cada uno nos
 * mandó alguna vez. Ángulo (decisión de Franco): LABURO es gratis y para todos,
 * te dejamos el perfil hecho, te encuentran otras productoras, no
 * intermediamos, tus precios solo con tu sí y te vas en un click.
 *
 * Tres idiomas por país: castellano (default), portugués (Brasil) e inglés
 * (Canadá, Estados Unidos, Reino Unido). Sin em dash, voseo en castellano.
 */

import { Body, Button, Container, Heading, Html, Link, Preview, Section, Text } from "@react-email/components";
import { Encabezado } from "./encabezado";

export type IdiomaRed = "es" | "pt" | "en";

export interface RedInvitacionEmailProps {
  idioma: IdiomaRed;
  /** proveedor o salon: el salón lee «tu espacio» y capacidad en vez de servicios. */
  tipo?: string;
  nombre: string;
  rubro: string | null;
  linkPanel: string;
  linkPerfil: string | null;
  linkPrecios: string;
  linkBaja: string;
}

const SURFACE_0 = "#000000";
const SURFACE_1 = "#0A0A0A";
const BORDER = "#1A1A1A";
const ACCENT = "#0047FF";
const FG = "#F5F5F5";
const FG_MUTED = "#8A8A8A";
const PRODUCTOS = [
  { nombre: "SOMOS DER", url: "https://somosder.ar" },
  { nombre: "LABURO", url: "https://laburo.somosder.ar" },
  { nombre: "HITO", url: "https://hito.agency" },
  { nombre: "PASE", url: "https://pase.somosder.ar" },
] as const;

const FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

export function idiomaDePais(pais: string | null | undefined): IdiomaRed {
  const p = (pais ?? "").toLowerCase();
  if (p.includes("brasil") || p.includes("brazil")) return "pt";
  if (p.includes("canad") || p.includes("estados unidos") || p.includes("united states") || p.includes("reino unido")) return "en";
  return "es";
}

const T = {
  es: {
    asunto: (n: string) => `${n}, ya tenés tu perfil en LABURO`,
    preview: "Te armamos el perfil gratis: te encuentran productoras de todos lados.",
    kicker: "Red de proveedores · gratis",
    titulo: (n: string) => `${n}, ya tenés tu perfil en LABURO`,
    p1: "Te escribe Franco, de SOMOS DER. En algún momento nos escribiste o te pedimos precio, y nos quedamos con tus datos.",
    p2: "Armamos LABURO, una red gratuita y abierta de proveedores, salones y staff para eventos. Sabemos que la mano está difícil: la idea es que cualquier productora que necesite algo, aunque sea a último momento, te encuentre rápido. No solo nosotros.",
    yaEsta: "Lo que ya está",
    yaEsta1: (r: string | null) => (r ? `Aparecés en ${r}, con tu nombre y tu país.` : "Aparecés en la red con tu nombre y tu país."),
    yaEsta2: "Las consultas te llegan directo a este mail.",
    boton: "Entrar a mi perfil",
    elegir: "Lo que podés elegir",
    elegir1: "Sumar fotos, servicios, zonas y precios desde tu panel.",
    precios: "Sí, publiquen mis precios de referencia",
    baja: "No quiero aparecer",
    noHacemos: "Lo que no hacemos",
    no1: "No cobramos nada.",
    no2: "No intermediamos: la productora te escribe a vos.",
    no3: "No publicamos tus precios si no nos decís que sí.",
    verPerfil: "Ver mi perfil público",
    dudas: "Cualquier duda, respondé este mail.",
    saludo: "Saludos,",
    pie: "Si no querés aparecer ni recibir más mails nuestros, lo sacamos en el momento:",
  },
  pt: {
    asunto: (n: string) => `${n}, seu perfil no LABURO já está pronto`,
    preview: "Montamos seu perfil de graça: produtoras de toda a região vão te encontrar.",
    kicker: "Rede de fornecedores · grátis",
    titulo: (n: string) => `${n}, seu perfil no LABURO já está pronto`,
    p1: "Quem escreve é Franco, da SOMOS DER, produtora de Buenos Aires. Em algum momento vocês nos escreveram ou pedimos um orçamento, e ficamos com seus dados.",
    p2: "Criamos o LABURO, uma rede gratuita e aberta de fornecedores, espaços e equipe para eventos. A ideia é que qualquer produtora que precise de algo, mesmo de última hora, encontre vocês rápido.",
    yaEsta: "O que já está pronto",
    yaEsta1: (r: string | null) => (r ? `Vocês aparecem em ${r}, com nome e país.` : "Vocês aparecem na rede com nome e país."),
    yaEsta2: "Os contatos chegam direto neste e-mail.",
    boton: "Entrar no meu perfil",
    elegir: "O que vocês podem escolher",
    elegir1: "Adicionar fotos, serviços, regiões e preços no painel.",
    precios: "Sim, publiquem nossos preços de referência",
    baja: "Não queremos aparecer",
    noHacemos: "O que não fazemos",
    no1: "Não cobramos nada.",
    no2: "Não intermediamos: a produtora fala direto com vocês.",
    no3: "Não publicamos preços sem a sua autorização.",
    verPerfil: "Ver meu perfil público",
    dudas: "Qualquer dúvida, é só responder este e-mail.",
    saludo: "Abraço,",
    pie: "Se não quiserem aparecer nem receber mais e-mails, tiramos na hora:",
  },
  en: {
    asunto: (n: string) => `${n}, your LABURO profile is ready`,
    preview: "We set up your profile for free: event producers can now find you.",
    kicker: "Supplier network · free",
    titulo: (n: string) => `${n}, your LABURO profile is ready`,
    p1: "This is Franco from SOMOS DER, an event production company in Buenos Aires. At some point you wrote to us or we asked you for a quote, and we kept your details.",
    p2: "We built LABURO, a free and open network of suppliers, venues and event staff. The idea is simple: any producer who needs something, even at the last minute, can find you fast.",
    yaEsta: "What's already there",
    yaEsta1: (r: string | null) => (r ? `You show up under ${r}, with your name and country.` : "You show up in the network with your name and country."),
    yaEsta2: "Inquiries go straight to this email.",
    boton: "Open my profile",
    elegir: "What you can choose",
    elegir1: "Add photos, services, areas and prices from your panel.",
    precios: "Yes, publish my reference prices",
    baja: "I don't want to be listed",
    noHacemos: "What we don't do",
    no1: "We don't charge anything.",
    no2: "We're not a middleman: producers contact you directly.",
    no3: "We never publish your prices without your OK.",
    verPerfil: "See my public profile",
    dudas: "Any questions, just reply to this email.",
    saludo: "Best,",
    pie: "If you don't want to be listed or get more emails from us, we'll remove you right away:",
  },
} as const;


/** Lo que cambia para un salón. El resto del mail es igual. */
const SALON = {
  es: {
    p2: "Armamos LABURO, una red gratuita y abierta de proveedores, salones y staff para eventos. Sabemos que la mano está difícil: la idea es que cualquier productora que busque dónde hacer su evento, aunque sea a último momento, encuentre tu espacio rápido. No solo nosotros.",
    yaEsta1: () => "Tu espacio aparece en Salones y espacios, con su nombre y su país.",
    elegir1: "Sumar fotos, capacidad, tipos de evento y precios desde tu panel.",
    boton: "Entrar al perfil de mi espacio",
  },
  pt: {
    p2: "Criamos o LABURO, uma rede gratuita e aberta de fornecedores, espaços e equipe para eventos. A ideia é que qualquer produtora que procure onde fazer seu evento, mesmo de última hora, encontre o espaço de vocês rápido.",
    yaEsta1: () => "O espaço de vocês aparece em Espaços para eventos, com nome e país.",
    elegir1: "Adicionar fotos, capacidade, tipos de evento e preços no painel.",
    boton: "Entrar no perfil do espaço",
  },
  en: {
    p2: "We built LABURO, a free and open network of suppliers, venues and event staff. The idea is simple: any producer looking for a place for their event, even at the last minute, can find your venue fast.",
    yaEsta1: () => "Your venue shows up under Venues, with its name and country.",
    elegir1: "Add photos, capacity, event types and prices from your panel.",
    boton: "Open my venue profile",
  },
} as const;

export function asuntoRedInvitacion(idioma: IdiomaRed, nombre: string): string {
  return T[idioma].asunto(nombre);
}

const txt = { margin: "0 0 14px 0", fontSize: "16px", lineHeight: 1.6, color: FG } as const;
const sub = { margin: "20px 0 8px 0", fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase" as const, color: ACCENT };
const item = { margin: "0 0 6px 0", fontSize: "15px", lineHeight: 1.5, color: FG } as const;
const link = { color: "#7FA2FF", textDecoration: "underline" } as const;

export function RedInvitacionEmail(p: RedInvitacionEmailProps) {
  const t = p.tipo === "salon" ? { ...T[p.idioma], ...SALON[p.idioma] } : T[p.idioma];
  return (
    <Html lang={p.idioma}>
      <Preview>{t.preview}</Preview>
      <Body style={{ margin: 0, padding: 0, backgroundColor: SURFACE_0, color: FG, fontFamily: FONT_STACK }}>
        <Container style={{ maxWidth: "480px", margin: "0 auto", padding: "32px 20px" }}>
          <Encabezado />
          <Section style={{ backgroundColor: SURFACE_1, border: `1px solid ${BORDER}`, padding: "28px 24px" }}>
            <Text style={{ ...sub, margin: "0 0 10px 0" }}>{t.kicker}</Text>
            <Heading as="h1" style={{ margin: "0 0 16px 0", fontSize: "22px", lineHeight: 1.25, fontWeight: 700, color: FG }}>
              {t.titulo(p.nombre)}
            </Heading>
            <Text style={txt}>{t.p1}</Text>
            <Text style={txt}>{t.p2}</Text>

            <Text style={sub}>{t.yaEsta}</Text>
            <Text style={item}>• {t.yaEsta1(p.rubro)}</Text>
            <Text style={item}>• {t.yaEsta2}</Text>

            <Section style={{ marginTop: "20px" }}>
              <Button
                href={p.linkPanel}
                style={{ display: "inline-block", backgroundColor: ACCENT, color: "#FFFFFF", fontSize: "16px", fontWeight: 600, textDecoration: "none", padding: "14px 28px" }}
              >
                {t.boton}
              </Button>
            </Section>
            {p.linkPerfil ? (
              <Text style={{ margin: "10px 0 0 0", fontSize: "13px", color: FG_MUTED }}>
                <Link href={p.linkPerfil} style={link}>{t.verPerfil}</Link>
              </Text>
            ) : null}

            <Text style={sub}>{t.elegir}</Text>
            <Text style={item}>• {t.elegir1}</Text>
            <Text style={item}>• <Link href={p.linkPrecios} style={link}>{t.precios}</Link></Text>
            <Text style={item}>• <Link href={p.linkBaja} style={link}>{t.baja}</Link></Text>

            <Text style={sub}>{t.noHacemos}</Text>
            <Text style={item}>• {t.no1}</Text>
            <Text style={item}>• {t.no2}</Text>
            <Text style={item}>• {t.no3}</Text>

            <Text style={{ ...txt, marginTop: "20px" }}>{t.dudas}</Text>
            <Text style={{ ...txt, margin: 0 }}>
              {t.saludo}
              <br />
              Franco
              <br />
              <span style={{ color: FG_MUTED, fontSize: "13px" }}>
                {PRODUCTOS.map((x, i) => (
                  <span key={x.nombre}>
                    {i > 0 ? " · " : ""}
                    <Link href={x.url} style={{ color: FG_MUTED, textDecoration: "underline" }}>{x.nombre}</Link>
                  </span>
                ))}
              </span>
            </Text>
          </Section>
          <Text style={{ margin: "12px 0 0 0", textAlign: "center", fontSize: "12px", lineHeight: 1.6, color: FG_MUTED }}>
            {t.pie} <Link href={p.linkBaja} style={{ color: FG_MUTED, textDecoration: "underline" }}>{t.baja}</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
