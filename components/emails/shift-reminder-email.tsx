/**
 * Email de RECORDATORIO del turno: "mañana trabajás" (o "hoy", si es el mismo día).
 * Molde de hired-email.tsx.
 *
 * PARA QUÉ: es el mail que baja el "no vino nadie". Alguien que aceptó un trabajo
 * hace tres semanas necesita que le recuerden el lugar y la hora el día antes, no
 * que lo vaya a buscar en un mail viejo. PASE ya tiene uno igual para los
 * asistentes de un evento y funciona.
 *
 * Lo importante del copy: los tres datos operativos (dónde, a qué hora, qué llevar)
 * y una salida clara para avisar si no va a poder ir. Un aviso a tiempo se
 * reemplaza; un ausente sin aviso, no.
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

export interface ShiftReminderEmailProps {
  firstName: string;
  gigTitle: string;
  role: string;
  whenText?: string | null;
  venue?: string | null;
  /** true si el evento arranca hoy (el cron corre a la mañana). */
  esHoy?: boolean;
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

export function ShiftReminderEmail({
  firstName,
  gigTitle,
  role,
  whenText,
  venue,
  esHoy = false,
  link,
}: ShiftReminderEmailProps) {
  const cuando = esHoy ? "Hoy" : "Mañana";
  const saludo = firstName?.trim()
    ? `${firstName.trim()}, ${esHoy ? "hoy" : "mañana"} te esperamos`
    : `${cuando} te esperamos`;

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
              {cuando} trabajás
            </Text>

            <Heading
              as="h1"
              style={{ margin: "0 0 16px 0", fontSize: "22px", lineHeight: 1.25, fontWeight: 700, color: FG }}
            >
              {saludo}
            </Heading>

            <Text style={{ margin: "0 0 8px 0", fontSize: "16px", lineHeight: 1.5, color: FG, fontWeight: 600 }}>
              {gigTitle}
            </Text>
            {role?.trim() ? (
              <Text style={{ margin: "0 0 8px 0", fontSize: "15px", lineHeight: 1.5, color: FG_MUTED }}>
                Tu rol: {role}
              </Text>
            ) : null}
            {whenText ? (
              <Text style={{ margin: "0 0 8px 0", fontSize: "15px", lineHeight: 1.5, color: FG }}>
                {whenText}
              </Text>
            ) : null}
            {venue?.trim() ? (
              <Text style={{ margin: "0 0 8px 0", fontSize: "15px", lineHeight: 1.5, color: FG }}>
                {venue}
              </Text>
            ) : null}

            <Text style={{ margin: "18px 0 0 0", fontSize: "15px", lineHeight: 1.6, color: FG_MUTED }}>
              Llevá tu DNI. Cuando llegues, fichá entrada desde el celular con el botón de abajo.
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
                Fichar cuando llegue
              </Button>
            </Section>

            <Text style={{ margin: "22px 0 0 0", fontSize: "13px", lineHeight: 1.5, color: FG_MUTED }}>
              Si pasó algo y no vas a llegar, avisanos ahora mismo respondiendo este mail.
              A tiempo se reemplaza sin drama.
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
