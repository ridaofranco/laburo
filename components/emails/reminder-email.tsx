/**
 * Email de RECORDATORIO de propuesta por vencer (XTRA-02 / D-05) como
 * componente react-email. Molde de offer-email.tsx.
 *
 * Copy en voseo argentino, cálido y directo, SIN em dash (regla dura de Franco).
 * Mismos colores de marca inline que la oferta (surface-0 de fondo, surface-1 en
 * la card, fg para el texto), 100% self-contained: los clientes de email ignoran
 * el CSS externo.
 *
 * ⭐ CAMBIO 26/7/2026 (pedido de Franco): AHORA SÍ TRAE BOTÓN.
 * Antes decía "revisá el email de la propuesta que te mandamos". Franco:
 * "pedirle que busque un mail viejo es una fricción que cuesta respuestas".
 * El mail que te apura a contestar era justo el que no te dejaba contestar.
 *
 * La decisión A1 original NO era un descuido: el link original es irrecuperable
 * a propósito (de la oferta solo se guarda el sha256, el token crudo aparece una
 * vez y se va en el mail). Eso no se aflojó. La migración 0030 agrega un SEGUNDO
 * token válido en paralelo: el recordatorio genera el suyo y **el link del mail
 * original sigue funcionando**, que era la condición que puso Franco.
 *
 * Si por lo que sea no llega `link`, el mail cae al texto de antes y sale igual:
 * un recordatorio sin botón es peor que uno con botón, pero mucho mejor que
 * ninguno.
 *
 * Los datos del candidato (firstName / gigTitle / role / expiresText) vienen del
 * pool y los escapa react-email por default en los children. NUNCA inyectamos
 * HTML crudo sobre datos del pool (mitigación T-5-25): sólo children escapados.
 *
 * IMPORTANTE para el consumidor (05-05 route): en react-email v2 `render()` es
 * ASYNC. Hay que `await render(<ReminderEmail .../>)` para el string HTML.
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

export interface ReminderEmailProps {
  firstName: string;
  gigTitle: string;
  role: string;
  expiresText?: string | null;
  /**
   * Link a la propuesta. Es el SEGUNDO token (migración 0030), no el original:
   * el original no se puede reconstruir porque solo se guarda su hash. Los dos
   * valen a la vez, así que el mail viejo tampoco se rompe.
   */
  link?: string | null;
}

// Colores de marca (espejo de app/globals.css @theme — Radical Minimalist).
const SURFACE_0 = "#000000";
const SURFACE_1 = "#0A0A0A";
const BORDER = "#1A1A1A";
const FG = "#F5F5F5";
const FG_MUTED = "#8A8A8A";
// El azul de LABURO, el mismo botón que la propuesta (offer-email.tsx).
const ACCENT = "#0047FF";

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

export function ReminderEmail({
  firstName,
  gigTitle,
  role,
  expiresText,
  link,
}: ReminderEmailProps) {
  const gigLine = `${role} · ${gigTitle}`;

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
            <Heading
              as="h1"
              style={{
                margin: "0 0 12px 0",
                fontSize: "22px",
                lineHeight: 1.25,
                fontWeight: 700,
                color: FG,
              }}
            >
              Hola {firstName}, tu propuesta está por vencer
            </Heading>

            <Text
              style={{
                margin: "0 0 12px 0",
                fontSize: "16px",
                lineHeight: 1.5,
                color: FG_MUTED,
              }}
            >
              {gigLine}
            </Text>

            {expiresText ? (
              <Text
                style={{
                  margin: "0 0 20px 0",
                  fontSize: "16px",
                  lineHeight: 1.5,
                  color: FG,
                }}
              >
                Vence el {expiresText}
              </Text>
            ) : null}

            {link ? (
              <>
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
                    Ver la propuesta
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
                  Confirmá desde el botón. Si ya tenías abierto el mail de la
                  propuesta, ese link también sigue andando. Cualquier duda,
                  respondé este mail y lo vemos juntos.
                </Text>
              </>
            ) : (
              <Text
                style={{
                  margin: "20px 0 0 0",
                  fontSize: "15px",
                  lineHeight: 1.6,
                  color: FG_MUTED,
                }}
              >
                Revisá el email de la propuesta que te mandamos y confirmá desde
                ahí, o respondé este mail y lo vemos juntos.
              </Text>
            )}
          </Section>
          <PieWhatsApp mensaje="Hola, te escribo por la propuesta de trabajo que está por vencer." />
        </Container>
      </Body>
    </Html>
  );
}
