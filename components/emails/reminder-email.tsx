/**
 * Email de RECORDATORIO de propuesta por vencer (XTRA-02 / D-05) como
 * componente react-email. Molde de offer-email.tsx.
 *
 * Copy en voseo argentino, cálido y directo, SIN em dash (regla dura de Franco).
 * Mismos colores de marca inline que la oferta (surface-0 de fondo, surface-1 en
 * la card, fg para el texto), 100% self-contained: los clientes de email ignoran
 * el CSS externo.
 *
 * DECISIÓN A1 (BLOQUEADA): este recordatorio NO trae link mágico ni ninguna
 * credencial de acceso. El link original de la oferta sigue vigente (el RPC
 * 05-01 no rota ni reconstruye la credencial, ni persiste el raw), así que acá
 * deliberadamente NO recibimos ni renderizamos ningún acceso accionable nuevo.
 * Sólo nudgeamos al candidato a volver al email original de la propuesta o a
 * responder este mail (mitigación T-5-23).
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
  Container,
  Heading,
  Html,
  Section,
  Text,
} from "@react-email/components";

export interface ReminderEmailProps {
  firstName: string;
  gigTitle: string;
  role: string;
  expiresText?: string | null;
}

// Colores de marca (espejo de app/globals.css @theme).
const SURFACE_0 = "#0A0F1F";
const SURFACE_1 = "#141B31";
const BORDER = "#2A3455";
const FG = "#F2F5FA";
const FG_MUTED = "#9AA5C0";

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

export function ReminderEmail({
  firstName,
  gigTitle,
  role,
  expiresText,
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
              borderRadius: "16px",
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
          </Section>

          <Text
            style={{
              margin: "20px 0 0 0",
              textAlign: "center",
              fontSize: "12px",
              lineHeight: 1.6,
              color: FG_MUTED,
            }}
          >
            SOMOS DER · Staff para eventos
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
