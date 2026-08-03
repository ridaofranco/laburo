/**
 * Mail con el LINK PARA ENTRAR (magic link), cuando alguien pide entrar sin
 * contraseña desde /login o /acceso-staff.
 *
 * Antes este mail no existía: lo mandaba Supabase con su propia plantilla, la
 * que Franco ya había marcado como "parece phishing". Ahora el link lo genera
 * `linkMagicoParaEntrar` y viaja adentro de nuestro mail, con nuestra marca.
 * El porqué técnico (PKCE, el link que "vencía" apenas lo abrías en el celu)
 * está escrito entero en lib/auth-link.ts.
 *
 * Reglas de la casa:
 *  · El copy describe lo que el link abre de verdad. Prometer una cosa y abrir
 *    otra ya costó una trabajadora el 1/8.
 *  · Nunca viaja una contraseña.
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

export interface LinkDeAccesoEmailProps {
  /** El link de acceso, ya armado por linkMagicoParaEntrar. */
  link: string;
  /** Cuántas horas dura, para escribirlo tal cual en el mail. */
  duracionHoras?: number;
}

const SURFACE_0 = "#000000";
const SURFACE_1 = "#0A0A0A";
const BORDER = "#1A1A1A";
const ACCENT = "#0047FF";
const FG = "#F5F5F5";
const FG_MUTED = "#8A8A8A";
const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

export function LinkDeAccesoEmail({
  link,
  duracionHoras = 1,
}: LinkDeAccesoEmailProps) {
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
              Tu acceso a LABURO
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
              Entrá con este link
            </Heading>

            <Text
              style={{ margin: "0 0 20px 0", fontSize: "16px", lineHeight: 1.6, color: FG }}
            >
              Tocá el botón y entrás directo, sin escribir ninguna contraseña.
              Podés abrirlo desde el teléfono o desde la computadora, no importa
              dónde hayas pedido el link.
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
              style={{ margin: "22px 0 0 0", fontSize: "14px", lineHeight: 1.5, color: FG_MUTED }}
            >
              El link sirve una sola vez y vence en{" "}
              {duracionHoras === 1 ? "una hora" : `${duracionHoras} horas`}. Si ya
              venció, pedí uno nuevo desde la pantalla de acceso.
            </Text>

            <Text
              style={{ margin: "14px 0 0 0", fontSize: "14px", lineHeight: 1.5, color: FG_MUTED }}
            >
              Si no funciona el botón, copiá y pegá esta dirección en tu navegador:
            </Text>
            <Text
              style={{
                margin: "6px 0 0 0",
                fontSize: "13px",
                lineHeight: 1.5,
                color: FG_MUTED,
                wordBreak: "break-all",
              }}
            >
              {link}
            </Text>

            <Text
              style={{ margin: "22px 0 0 0", fontSize: "14px", lineHeight: 1.5, color: FG_MUTED }}
            >
              Si no pediste entrar, ignorá este mail. Sin tocar el link no pasa
              nada.
            </Text>
          </Section>
          <PieWhatsApp />
        </Container>
      </Body>
    </Html>
  );
}
