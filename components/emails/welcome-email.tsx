/**
 * Email de BIENVENIDA a LABURO como componente react-email. Molde de
 * offer-email.tsx (mismos tokens de marca inline, self-contained: los clientes
 * de email ignoran el CSS externo).
 *
 * PARA QUÉ: las 699 fichas que ya están en la base (import del Sheet + el
 * formulario viejo de somosder.ar) nunca recibieron nada. Este es el mail que
 * las invita a entrar por primera vez a revisar y completar su perfil, que es la
 * Pieza 2 del plan de LABURO: una base que se mantiene viva en vez de envejecer.
 *
 * Copy en voseo argentino, SIN em dash (regla dura de Franco), y con el marco que
 * pidió: no es "quedaste en una lista, esperá", es "tu perfil ya está, entrá".
 *
 * ⚠️⚠️ NO ESCRIBIR QUE LA PERSONA ES "PARTE DEL EQUIPO DE SOMOS DER".
 * Decisión de Franco del 26/7 por riesgo legal, y tiene razón: quien está en
 * LABURO NO es empleado ni integrante del equipo, es alguien que quedó en la
 * base y que puede recibir propuestas para eventos puntuales. Dejar por escrito
 * "ya sos parte del equipo" en un mail es exactamente la frase que después se
 * usa para reclamar una relación laboral que no existe. El mail tiene que ser
 * cálido igual, pero sobre lo que de verdad pasó: el perfil está creado y desde
 * ahí llegan propuestas.
 *
 * NO LLEVA CREDENCIAL: el link es la pantalla pública /acceso-staff, donde la
 * persona pide su propio link con su mail. Así este mail no transporta ningún
 * acceso accionable (si se filtra o se reenvía, no abre nada), y el gate de
 * /acceso-staff sigue siendo el que valida contra el pool.
 *
 * El nombre viene del pool y react-email lo escapa por default en los children.
 * Nunca inyectamos HTML crudo sobre datos del pool.
 *
 * IMPORTANTE para el consumidor (la route del cron): en react-email v2 `render()`
 * es ASYNC, hay que `await render(<WelcomeEmail .../>)`.
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
import { PieWhatsApp } from "./pie-whatsapp";

export interface WelcomeEmailProps {
  firstName: string;
  link: string;
  /**
   * Link de baja del pool ("no quiero formar parte"). Va al pie, en chico pero
   * legible y sin vueltas. No está escondido a propósito: el que puede irse en un
   * click no nos marca como spam, y no tiene sentido tener en la base a alguien
   * que no quiere que lo llamemos.
   */
  bajaLink?: string;
}

// Tokens de marca (espejo de app/globals.css @theme — Radical Minimalist).
const SURFACE_0 = "#000000";
const SURFACE_1 = "#0A0A0A";
const BORDER = "#1A1A1A";
const ACCENT = "#0047FF";
const FG = "#F5F5F5";
const FG_MUTED = "#8A8A8A";

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

export function WelcomeEmail({ firstName, link, bajaLink }: WelcomeEmailProps) {
  const saludo = firstName?.trim() ? `Hola ${firstName.trim()}` : "Hola";

  return (
    <Html lang="es">
      <Body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: SURFACE_0,
          color: FG,
          fontFamily: FONT_STACK,
        }}
      >
        <Container
          style={{
            maxWidth: "480px",
            margin: "0 auto",
            padding: "32px 20px",
          }}
        >
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
              style={{
                margin: "0 0 16px 0",
                fontSize: "22px",
                lineHeight: 1.25,
                fontWeight: 700,
                color: FG,
              }}
            >
              {saludo}, tu perfil ya está en LABURO
            </Heading>

            <Text
              style={{
                margin: "0 0 14px 0",
                fontSize: "16px",
                lineHeight: 1.6,
                color: FG,
              }}
            >
              Armamos LABURO para organizar el staff de nuestros eventos, y tu
              perfil ya está creado ahí con los datos que nos dejaste. Desde
              ahora te pueden llegar propuestas para trabajar en los eventos que
              vayan con lo tuyo.
            </Text>

            <Text
              style={{
                margin: "0 0 20px 0",
                fontSize: "16px",
                lineHeight: 1.6,
                color: FG_MUTED,
              }}
            >
              Entrá con este mismo mail para revisarlo y completar lo que falte.
              No hace falta contraseña: ponés tu mail y te mandamos un link para
              entrar. Cuanto más completo esté tu perfil, más fácil es que te
              llamemos para el evento que te corresponde.
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
                Entrar a LABURO
              </Button>
            </Section>

            <Text
              style={{
                margin: "24px 0 0 0",
                fontSize: "13px",
                lineHeight: 1.5,
                color: FG_MUTED,
              }}
            >
              Si el botón no abre, copiá y pegá esta dirección en el navegador:{" "}
              {link}
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
