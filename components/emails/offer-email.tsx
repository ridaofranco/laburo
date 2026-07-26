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
import { Encabezado } from "./encabezado";
import { PieWhatsApp } from "./pie-whatsapp";

export interface OfferEmailProps {
  firstName: string;
  gigTitle: string;
  role: string;
  amount?: number | null;
  conditions?: string | null;
  whenText?: string | null;
  link: string;
  /**
   * ⭐ LOS TRES DATOS QUE FALTABAN (pedido de Franco, 26/7).
   *
   * El mail contaba el rol, el evento y cuánto se paga, pero no las tres cosas
   * que cualquiera se pregunta antes de decir que sí: dónde es, hasta cuándo
   * tengo para contestar, y cuándo cobro. El lugar existía en el sistema pero
   * vivía solo del otro lado del link, así que para saber si le quedaba cerca
   * había que entrar.
   */
  venue?: string | null;
  expiresText?: string | null;
  paymentText?: string | null;
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
  venue,
  expiresText,
  paymentText,
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
          <Encabezado />
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

            {/* Los datos duros, uno abajo del otro, para que se lean de un vistazo
                en el celular sin tener que abrir el link. */}
            {venue ? (
              <Text
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "16px",
                  lineHeight: 1.5,
                  color: FG,
                }}
              >
                Dónde: {venue}
              </Text>
            ) : null}

            {amount != null ? (
              <Text
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "16px",
                  lineHeight: 1.5,
                  color: FG,
                }}
              >
                Pago (informativo): {formatAmount(amount)}
              </Text>
            ) : null}

            {paymentText ? (
              <Text
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "15px",
                  lineHeight: 1.5,
                  color: FG_MUTED,
                }}
              >
                {paymentText}
              </Text>
            ) : null}

            {expiresText ? (
              <Text
                style={{
                  margin: "0 0 12px 0",
                  fontSize: "16px",
                  lineHeight: 1.5,
                  color: FG,
                }}
              >
                Tenés tiempo de contestar hasta el {expiresText}
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
                  borderRadius: "0",
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
              respondé este mail y lo vemos.
            </Text>
          </Section>
          <PieWhatsApp mensaje="Hola, te escribo por la propuesta de trabajo que me mandaron." />
        </Container>
      </Body>
    </Html>
  );
}
