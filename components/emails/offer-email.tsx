/**
 * Email de OFERTA de laburo (D-02) como componente react-email.
 *
 * Copy en voseo argentino, cálido y directo, SIN em dash (regla dura de Franco).
 * Estilos inline oscuros que hacen eco de los tokens de marca (surface-0 de
 * fondo, accent en el CTA, fg para el texto) pero 100% self-contained: los
 * clientes de email ignoran el CSS externo.
 *
 * Los datos del candidato (firstName / gigTitle / conditions) vienen del pool y
 * los escapa react-email por default en los children. NUNCA inyectamos HTML
 * crudo sobre datos del pool (mitigación T-3-06): sólo children escapados.
 *
 * IMPORTANTE para el consumidor (03-03): en react-email v2 `render()` es ASYNC.
 * Hay que `await render(<OfferEmail .../>)` para obtener el string HTML.
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

export interface OfferEmailProps {
  firstName: string;
  gigTitle: string;
  role: string;
  amount?: number | null;
  conditions?: string | null;
  whenText?: string | null;
  link: string;
}

// Tokens de marca (espejo de app/globals.css @theme).
const SURFACE_0 = "#0A0F1F";
const SURFACE_1 = "#141B31";
const BORDER = "#2A3455";
const ACCENT = "#2F80FF";
const FG = "#F2F5FA";
const FG_MUTED = "#9AA5C0";

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

function formatAmount(amount: number): string {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${amount}`;
  }
}

export function OfferEmail({
  firstName,
  gigTitle,
  role,
  amount,
  conditions,
  whenText,
  link,
}: OfferEmailProps) {
  const gigLine = `${role} · ${gigTitle}${whenText ? ` · ${whenText}` : ""}`;

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
              Hola {firstName}, tenés una propuesta de laburo
            </Heading>

            <Text
              style={{
                margin: "0 0 20px 0",
                fontSize: "16px",
                lineHeight: 1.5,
                color: FG_MUTED,
              }}
            >
              {gigLine}
            </Text>

            {amount != null ? (
              <Text
                style={{
                  margin: "0 0 12px 0",
                  fontSize: "16px",
                  lineHeight: 1.5,
                  color: FG,
                }}
              >
                Pago (informativo): {formatAmount(amount)}
              </Text>
            ) : null}

            {conditions ? (
              <Text
                style={{
                  margin: "0 0 20px 0",
                  fontSize: "15px",
                  lineHeight: 1.6,
                  color: FG_MUTED,
                  whiteSpace: "pre-line",
                }}
              >
                {conditions}
              </Text>
            ) : null}

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
                  borderRadius: "12px",
                }}
              >
                Ver la oferta
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
              Mirá los detalles y confirmá desde el botón. Si tenés alguna duda,
              respondé este mail o escribinos por WhatsApp.
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
