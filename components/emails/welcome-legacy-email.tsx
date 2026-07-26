/**
 * BIENVENIDA A LABURO PARA LOS QUE YA SE HABÍAN POSTULADO (la tanda a los 699).
 *
 * ── POR QUÉ ES UN MAIL DISTINTO Y NO EL MISMO ──
 * Decisión de Franco (26/7). Son dos situaciones que no se parecen:
 *
 *  · **El que se registra HOY** en somosder.ar ya sabe que se está postulando y
 *    acaba de hacerlo. Recibe dos mails cortos: el acuse de recibo de DER (que le
 *    avisa que sus datos se cargan en LABURO) y el acceso. Ese es
 *    `welcome-email.tsx`, y lo dispara el formulario de la web.
 *
 *  · **El que se postuló hace meses** no espera nada nuestro. Le llega un mail de
 *    un producto del que nunca escuchó hablar, y encima con su perfil ya cargado
 *    adentro. Ese mail tiene que explicar de dónde salió LABURO, por qué su dato
 *    está ahí y qué gana. Si le llega el corto, la reacción razonable es "¿y esto
 *    quién es?" o directamente spam. Ese es ESTE mail, y lo dispara el cron de la
 *    tanda.
 *
 * Es el único mail del ecosistema que sale a cientos de personas de una, así que
 * es también el único que justifica ser largo: es la única oportunidad de contar
 * la historia completa.
 *
 * ── COPY ── Aprobado por Franco el 26/7 con tres cambios suyos:
 *   1. "productora chica" → "productora en crecimiento".
 *   2. "que ese perfil esté a mano de verdad, y no una vez cada tanto" →
 *      "y no solo para nosotros" (que además es lo que de verdad va a pasar
 *      cuando se abra a otras productoras).
 *   3. Se sacó el "no generamos el volumen para darle trabajo a todos", porque
 *      leído del otro lado le dice a la persona que es parte de un excedente.
 *
 * ⚠️⚠️ NO ESCRIBIR QUE LA PERSONA ES PARTE DEL EQUIPO DE SOMOS DER (riesgo legal,
 * decisión de Franco). Quien está en LABURO no es empleado: es alguien que quedó
 * en la base y que puede recibir propuestas para eventos puntuales. Por eso el
 * bullet de aceptar una propuesta dice "quedás confirmado/a para ese evento" y no
 * "quedás en el equipo": el equipo es siempre el del evento puntual.
 */

import {
  Body,
  Button,
  Container,
  Heading,
  Html,
  Section,
  Text,
} from "@react-email/components";
import { Encabezado } from "./encabezado";
import { PieWhatsApp } from "./pie-whatsapp";

export interface WelcomeLegacyEmailProps {
  firstName: string;
  link: string;
  bajaLink?: string;
}

const SURFACE_0 = "#000000";
const SURFACE_1 = "#0A0A0A";
const BORDER = "#1A1A1A";
const ACCENT = "#0047FF";
const FG = "#F5F5F5";
const FG_MUTED = "#8A8A8A";

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

const P = { margin: "0 0 14px 0", fontSize: "15px", lineHeight: 1.65, color: FG } as const;
const P_MUT = { ...P, color: FG_MUTED } as const;
const SUB = {
  margin: "22px 0 10px 0",
  fontSize: "13px",
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
  color: FG,
  fontWeight: 700,
} as const;

/** Ítem de lista. El • va aparte para que no dependa de <ul>, que varios
 *  clientes de correo renderizan con sangrías raras. */
function Item({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ margin: "0 0 10px 0", fontSize: "15px", lineHeight: 1.6, color: FG_MUTED }}>
      <span style={{ color: ACCENT, fontWeight: 700 }}>· </span>
      {children}
    </Text>
  );
}

export function WelcomeLegacyEmail({ firstName, link, bajaLink }: WelcomeLegacyEmailProps) {
  const saludo = firstName?.trim()
    ? `Hola ${firstName.trim()}, gracias por haberte postulado`
    : "Gracias por haberte postulado";

  return (
    <Html lang="es">
      <Body style={{ margin: 0, padding: 0, backgroundColor: SURFACE_0, color: FG, fontFamily: FONT_STACK }}>
        <Container style={{ maxWidth: "480px", margin: "0 auto", padding: "32px 20px" }}>
          <Encabezado />
          <Section
            style={{
              backgroundColor: SURFACE_1,
              border: `1px solid ${BORDER}`,
              borderRadius: "0",
              padding: "28px 24px",
            }}
          >
            <Text
              style={{
                margin: "0 0 10px 0",
                fontSize: "11px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: ACCENT,
              }}
            >
              Bienvenido/a a LABURO
            </Text>

            <Heading
              as="h1"
              style={{ margin: "0 0 18px 0", fontSize: "22px", lineHeight: 1.25, fontWeight: 700, color: FG }}
            >
              {saludo}
            </Heading>

            <Text style={P}>
              Te escribimos de SOMOS DER. Hace un tiempo dejaste tus datos para trabajar con
              nosotros en eventos, y queremos empezar por lo primero: gracias. Somos una
              productora en crecimiento, y que alguien se tome el trabajo de cargar todo y
              mandarnos su CV no es poca cosa.
            </Text>

            <Text style={P}>
              Leímos los perfiles uno por uno, y lo que apareció del otro lado fue un equipo:
              gente con oficio, con experiencia real y con ganas de trabajar. Demasiado bueno
              para quedar guardado en una planilla que se abre solo cuando nosotros tenemos un
              evento.
            </Text>

            <Text style={P}>
              Así que construimos algo para que ese perfil esté a mano de verdad, y no solo
              para nosotros: <strong style={{ color: FG }}>LABURO</strong>.
            </Text>

            <Text style={SUB}>Cómo funciona, de tu lado</Text>
            <Item>
              Tenés un perfil propio, armado con lo que ya nos habías mandado. Entrás con este
              mismo mail y lo completás o lo corregís vos.
            </Item>
            <Item>
              Cuando hay un evento que va con tu oficio, tu provincia y tu disponibilidad, te
              llega una propuesta con el rol, las fechas y cuánto se paga.
            </Item>
            <Item>
              La aceptás o la rechazás desde el mail. Si aceptás, quedás confirmado/a para ese
              evento, fichás entrada y salida desde el celular y el pago queda registrado ahí.
            </Item>
            <Item>
              Tu teléfono y tu mail no quedan a la vista de nadie. El contacto se coordina por
              SOMOS DER.
            </Item>

            <Text style={SUB}>Cómo funciona del otro lado</Text>
            <Item>
              Una productora que necesita gente busca por oficio, provincia y disponibilidad,
              ve la ficha profesional (experiencia y formación, sin datos de contacto) y manda
              la propuesta.
            </Item>
            <Item>
              Hoy arrancamos con nuestros propios eventos. La idea es abrirlo a otras
              productoras del país, para que el mismo perfil te sirva para trabajar con varias
              y no solo con nosotros.
            </Item>

            <Text style={{ ...P, marginTop: "22px" }}>
              Estamos empezando a mostrarlo, así que cualquier cosa que veas y te falte,
              decínosla. Respondé este mail y lo leemos. Lo que nos digas ahora es lo que le va
              a servir al que entre después.
            </Text>

            <Text style={P_MUT}>
              Una última cosa: DER hoy también está trabajando para clientes de afuera del
              país, y eso ya está en funcionamiento. Puede pasar que salga una activación en el
              exterior y necesitemos gente. Tener tu perfil completo y al día es lo que hace
              que te podamos llamar cuando eso aparece.
            </Text>

            <Section style={{ marginTop: "24px" }}>
              <Button
                href={link}
                style={{
                  display: "inline-block",
                  backgroundColor: ACCENT,
                  color: "#FFFFFF",
                  fontSize: "16px",
                  fontWeight: 600,
                  textDecoration: "none",
                  padding: "14px 28px",
                  borderRadius: "0",
                }}
              >
                Entrar a ver mi perfil
              </Button>
            </Section>

            <Text style={{ margin: "18px 0 0 0", fontSize: "13px", lineHeight: 1.5, color: FG_MUTED }}>
              Se entra con este mismo mail. Si el botón no abre, copiá y pegá esta dirección en
              el navegador: {link}
            </Text>
          </Section>

          <PieWhatsApp mensaje="Hola, te escribo por mi perfil de LABURO." />

          {bajaLink ? (
            <Text
              style={{
                margin: "8px 0 0 0",
                textAlign: "center",
                fontSize: "12px",
                lineHeight: 1.6,
                color: FG_MUTED,
              }}
            >
              Si no querés formar parte, te sacamos en un click:{" "}
              <a href={bajaLink} style={{ color: FG_MUTED, textDecoration: "underline" }}>
                darme de baja
              </a>
            </Text>
          ) : null}
        </Container>
      </Body>
    </Html>
  );
}
