/**
 * Email "TU PAGO ESTÁ LISTO": el cierre del ciclo laburo hecho → pago coordinado.
 * Molde de hired-email.tsx (mismos tokens de marca, self-contained).
 *
 * PARA QUÉ: la oferta ya le dijo a la persona la política real (PAGO_TEXTO: el
 * pago se coordina dentro de los 10 días hábiles de realizado el trabajo). Pero
 * cuando Franco efectivamente coordina o hace el pago, la persona no se entera
 * por ningún lado: se entera cuando le cae la plata o cuando pregunta por
 * WhatsApp a las 11 de la noche. Este mail es ese aviso.
 *
 * ⚠️ QUÉ DICE Y QUÉ NO: dice "quedó coordinado / está en marcha", NO dice "ya
 * te lo transferimos" (el sistema no sabe si la plata salió: LABURO no procesa
 * pagos, decisión v1). Tampoco promete fecha exacta más allá de la política.
 * Si la persona no lo recibió en lo hablado, el camino es el WhatsApp del pie.
 *
 * Copy en voseo, sin em dash (regla dura de Franco). Los datos vienen del pool
 * y react-email los escapa en los children: nunca HTML crudo.
 */

import {
  Body,
  Container,
  Heading,
  Html,
  Section,
  Text,
} from "@react-email/components";
import { Encabezado } from "./encabezado";
import { PieWhatsApp } from "./pie-whatsapp";

export interface PagoListoEmailProps {
  firstName: string;
  gigTitle?: string | null;
  role?: string | null;
  /** Monto ya formateado ("$ 45.000") o null si la oferta fue "a convenir". */
  amountText?: string | null;
  /** La política real de pago (PAGO_TEXTO de lib/pago.ts). */
  paymentText: string;
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

export function PagoListoEmail({
  firstName,
  gigTitle,
  role,
  amountText,
  paymentText,
}: PagoListoEmailProps) {
  const evento = gigTitle?.trim();
  const saludo = firstName?.trim()
    ? `${firstName.trim()}, tu pago${evento ? ` por ${evento}` : ""} está listo`
    : `Tu pago${evento ? ` por ${evento}` : ""} está listo`;

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
              Pago
            </Text>

            <Heading
              as="h1"
              style={{ margin: "0 0 16px 0", fontSize: "22px", lineHeight: 1.25, fontWeight: 700, color: FG }}
            >
              {saludo}
            </Heading>

            <Text style={{ margin: "0 0 18px 0", fontSize: "15px", lineHeight: 1.6, color: FG_MUTED }}>
              Gracias por el laburo. Ya dejamos tu pago coordinado: esto es un
              aviso para que sepas que está en marcha y no tengas que preguntar.
            </Text>

            <Row label="Evento" value={gigTitle} />
            <Row label="Tu rol" value={role} />
            <Row label="Monto" value={amountText} />

            <Text style={{ margin: "18px 0 0 0", fontSize: "15px", lineHeight: 1.6, color: FG }}>
              {paymentText}
            </Text>

            <Text style={{ margin: "18px 0 0 0", fontSize: "13px", lineHeight: 1.5, color: FG_MUTED }}>
              Si pasó ese plazo y no lo recibiste, o el monto no coincide con lo
              hablado, escribinos por WhatsApp y lo resolvemos.
            </Text>
          </Section>
          <PieWhatsApp mensaje="Hola, te escribo por el pago de mi laburo." />
        </Container>
      </Body>
    </Html>
  );
}
