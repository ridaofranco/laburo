/**
 * Email INTERNO: alguien respondió una propuesta (aceptó o rechazó).
 *
 * PARA QUÉ: hoy Franco se entera solo si entra a mirar el tablero. La parte útil de
 * este mail no es "alguien aceptó", es la línea de abajo: **cómo va el equipo del
 * evento**. Eso es lo que le dice si tiene que salir a buscar más gente hoy o ya
 * está cubierto, que es la única decisión que importa en ese momento.
 *
 * Va al mail de administración (MAIL_ADMIN_TO), no a la persona.
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

export interface OfferAnswerEmailProps {
  /** true = aceptó, false = rechazó. */
  accepted: boolean;
  staffName: string;
  gigTitle: string;
  role: string;
  amountText?: string | null;
  /** Cuántos roles pide el evento en total (suma de cupos). */
  slotsTotal?: number | null;
  /** Cuántos ya están contratados. */
  crewTotal?: number | null;
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

export function OfferAnswerEmail({
  accepted,
  staffName,
  gigTitle,
  role,
  amountText,
  slotsTotal,
  crewTotal,
  link,
}: OfferAnswerEmailProps) {
  const titulo = `${staffName || "Alguien"} ${accepted ? "aceptó" : "rechazó"}`;

  // Solo se muestra si el evento tiene los cupos cargados. Sin eso, la línea
  // mentiría (diría "0 de 0") y es peor que no decir nada.
  const total = Number(slotsTotal ?? 0);
  const cubiertos = Number(crewTotal ?? 0);
  const faltan = Math.max(0, total - cubiertos);
  const equipo =
    total > 0
      ? faltan > 0
        ? `${cubiertos} de ${total} roles cubiertos. Faltan ${faltan}.`
        : `${cubiertos} de ${total} roles cubiertos. El equipo está completo.`
      : null;

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
              Respuesta a una propuesta
            </Text>

            <Heading
              as="h1"
              style={{ margin: "0 0 14px 0", fontSize: "22px", lineHeight: 1.25, fontWeight: 700, color: FG }}
            >
              {titulo}
            </Heading>

            <Text style={{ margin: "0 0 12px 0", fontSize: "15px", lineHeight: 1.6, color: FG }}>
              {[role, gigTitle, amountText].filter(Boolean).join(" · ")}
            </Text>

            {equipo ? (
              <Text style={{ margin: "0 0 4px 0", fontSize: "15px", lineHeight: 1.6, color: FG }}>
                <span style={{ color: FG_MUTED }}>Cómo va el equipo: </span>
                {equipo}
              </Text>
            ) : (
              <Text style={{ margin: "0 0 4px 0", fontSize: "14px", lineHeight: 1.6, color: FG_MUTED }}>
                Este evento no tiene los roles y cupos cargados, así que no puedo decirte cuánto
                falta para completar el equipo.
              </Text>
            )}

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
                Abrir el tablero del evento
              </Button>
            </Section>
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
            LABURO · SOMOS DER
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
