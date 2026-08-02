/**
 * Mail de bienvenida de la PRODUCTORA que se registró sola (Fase 2).
 *
 * Mismo molde y mismas reglas que el del staff:
 *  · El copy tiene que describir lo que el link abre. El 1/8 el mail del staff
 *    decía "no hace falta contraseña" y mandaba a una pantalla que pedía una, y
 *    eso costó una trabajadora.
 *  · Lleva el link para ELEGIR la contraseña, nunca una contraseña.
 *  · Nada de em dash (regla dura de Franco).
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

export interface BienvenidaProductoraProps {
  /** Cómo se llama la productora, tal cual la escribió. */
  productora: string;
  /** Link para elegir la contraseña, o /login si no se pudo generar. */
  link: string;
  conLinkDeClave?: boolean;
}

const SURFACE_0 = "#000000";
const SURFACE_1 = "#0A0A0A";
const BORDER = "#1A1A1A";
const ACCENT = "#0047FF";
const FG = "#F5F5F5";
const FG_MUTED = "#8A8A8A";
const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

export function BienvenidaProductora({
  productora,
  link,
  conLinkDeClave = false,
}: BienvenidaProductoraProps) {
  return (
    <Html lang="es">
      <Body
        style={{
          margin: 0,
          padding: "32px 0",
          backgroundColor: SURFACE_0,
          fontFamily: FONT_STACK,
        }}
      >
        <Container
          style={{ width: "100%", maxWidth: "560px", margin: "0 auto", padding: "0 16px" }}
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
            <Text
              style={{
                margin: "0 0 10px 0",
                fontSize: "11px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: ACCENT,
              }}
            >
              Bienvenidos a LABURO
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
              {productora} ya tiene su cuenta
            </Heading>

            <Text
              style={{ margin: "0 0 14px 0", fontSize: "16px", lineHeight: 1.6, color: FG }}
            >
              Desde LABURO cargás tus eventos, publicás qué personal necesitás y
              te llegan las personas que quieren trabajar. Vos elegís y mandás la
              oferta con el monto y las fechas.
            </Text>

            <Text
              style={{ margin: "0 0 20px 0", fontSize: "16px", lineHeight: 1.6, color: FG_MUTED }}
            >
              {conLinkDeClave
                ? "Para entrar, elegí tu contraseña acá abajo. Es una sola vez: después entrás siempre con este mismo mail y esa clave."
                : "Para entrar, andá a laburo.somosder.ar y creá tu contraseña con el botón que dice que es tu primera vez."}
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
                {conLinkDeClave ? "Elegir mi contraseña" : "Entrar a LABURO"}
              </Button>
            </Section>

            {conLinkDeClave ? (
              <Text
                style={{ margin: "18px 0 0 0", fontSize: "14px", lineHeight: 1.5, color: FG_MUTED }}
              >
                Este link es tuyo y por seguridad dura poco. Si ya venció, entrá a
                laburo.somosder.ar y tocá donde dice que es tu primera vez.
              </Text>
            ) : null}

            <Text
              style={{ margin: "24px 0 0 0", fontSize: "13px", lineHeight: 1.5, color: FG_MUTED }}
            >
              Publicar es gratis. Cuando publiques una búsqueda, la va a ver el
              pool de personas de LABURO y se pueden postular solas.
            </Text>
          </Section>
          <PieWhatsApp mensaje="Hola, te escribo por mi cuenta de productora en LABURO." />
        </Container>
      </Body>
    </Html>
  );
}
