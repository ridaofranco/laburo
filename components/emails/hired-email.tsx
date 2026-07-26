/**
 * Email de CONFIRMACIÓN al que aceptó la propuesta: "quedaste en el equipo".
 * Molde de offer-email.tsx.
 *
 * PARA QUÉ: hasta ahora la persona aceptaba y no recibía NADA por escrito. Es el
 * momento exacto en que pasa de "me ofrecieron algo" a "tengo que estar el viernes
 * a las 8 en tal lugar", y todo lo que no queda por escrito termina en un WhatsApp
 * a las 11 de la noche pidiendo la dirección.
 *
 * Lleva los cinco datos que la persona necesita y hoy no tiene juntos en ningún
 * lado: evento, rol, cuándo, dónde y cuánto se paga. Más el link para fichar, que
 * es lo que deja registrado que estuvo.
 *
 * Copy en voseo, sin em dash (regla dura de Franco). Los datos vienen del pool y
 * react-email los escapa en los children: nunca HTML crudo.
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

export interface HiredEmailProps {
  firstName: string;
  gigTitle: string;
  role: string;
  whenText?: string | null;
  venue?: string | null;
  amountText?: string | null;
  conditions?: string | null;
  link: string;
}

const SURFACE_0 = "#000000";
const SURFACE_1 = "#0A0A0A";
const BORDER = "#1A1A1A";
const ACCENT = "#0047FF";
const FG = "#F5F5F5";
const FG_MUTED = "#8A8A8A";

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

/** Fila etiqueta/valor. Se omite sola si el valor no vino. */
function Row({ label, value }: { label: string; value?: string | null }) {
  const v = (value ?? "").trim();
  if (!v) return null;
  return (
    <Text style={{ margin: "0 0 10px 0", fontSize: "15px", lineHeight: 1.5, color: FG }}>
      <span style={{ color: FG_MUTED }}>{label}: </span>
      {v}
    </Text>
  );
}

export function HiredEmail({
  firstName,
  gigTitle,
  role,
  whenText,
  venue,
  amountText,
  conditions,
  link,
}: HiredEmailProps) {
  const saludo = firstName?.trim() ? `${firstName.trim()}, quedaste en el equipo` : "Quedaste en el equipo";

  return (
    <Html lang="es">
      <Body style={{ margin: 0, padding: 0, backgroundColor: SURFACE_0, color: FG, fontFamily: FONT_STACK }}>
        <Container style={{ maxWidth: "480px", margin: "0 auto", padding: "32px 20px" }}>
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
              Confirmado
            </Text>

            <Heading
              as="h1"
              style={{ margin: "0 0 16px 0", fontSize: "22px", lineHeight: 1.25, fontWeight: 700, color: FG }}
            >
              {saludo}
            </Heading>

            <Text style={{ margin: "0 0 18px 0", fontSize: "15px", lineHeight: 1.6, color: FG_MUTED }}>
              Ya está cerrado. Estos son los datos, guardalos.
            </Text>

            <Row label="Evento" value={gigTitle} />
            <Row label="Tu rol" value={role} />
            <Row label="Cuándo" value={whenText} />
            <Row label="Dónde" value={venue} />
            <Row label="Se paga" value={amountText} />
            <Row label="Condiciones" value={conditions} />

            <Text style={{ margin: "18px 0 0 0", fontSize: "15px", lineHeight: 1.6, color: FG_MUTED }}>
              El día del evento fichás entrada y salida desde tu celular, con el botón de abajo.
              Es lo que deja registrado que estuviste y por cuánto tiempo.
            </Text>

            <Section style={{ marginTop: "22px" }}>
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
                Ver los detalles y fichar
              </Button>
            </Section>

            <Text style={{ margin: "22px 0 0 0", fontSize: "13px", lineHeight: 1.5, color: FG_MUTED }}>
              Si te surge algo y no vas a poder ir, avisanos lo antes posible respondiendo este mail.
              Se reemplaza sin drama si hay tiempo.
            </Text>
          </Section>
          <PieWhatsApp mensaje="Hola, te escribo porque quedé en el equipo de un evento." />
        </Container>
      </Body>
    </Html>
  );
}
