/**
 * "Te sumaron al equipo de <productora> en LABURO".
 *
 * ⚠️ EL MAIL DICE CON QUÉ DIRECCIÓN HAY QUE ENTRAR, y no es un detalle de copy:
 * la invitación es para UN mail, no para cualquiera que tenga el link (lo valida
 * `staff_app_aceptar_invitacion_miembro`). Sin decirlo, el que tiene dos cuentas
 * entra con la equivocada, le rebota, y no entiende por qué.
 *
 * Tampoco promete lo que el rol no da: se nombra qué va a poder hacer, porque
 * "te invitaron al equipo" sin más deja a un `viewer` creyendo que puede cargar
 * eventos.
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

export interface InvitacionEquipoProps {
  /** La productora que invita. */
  productora: string;
  /** El mail al que se mandó: es el único con el que se puede aceptar. */
  email: string;
  /** owner | manager | writer | viewer */
  rol: string;
  /** "el lunes 21 de septiembre", ya formateado. */
  vence: string | null;
  link: string;
}

const SURFACE_0 = "#000000";
const SURFACE_1 = "#0A0A0A";
const SURFACE_2 = "#121212";
const BORDER = "#1A1A1A";
const ACCENT = "#0047FF";
const FG = "#F5F5F5";
const FG_MUTED = "#8A8A8A";
const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const P = { margin: "0 0 14px 0", fontSize: "15px", lineHeight: 1.65, color: FG } as const;

/** Qué puede hacer de verdad cada rol, en una línea. */
function queHace(rol: string): string {
  switch (rol) {
    case "manager":
      return "Vas a poder buscar staff, armar eventos, mandar ofertas y sumar gente al equipo.";
    case "writer":
      return "Vas a poder buscar staff, armar eventos y mandar ofertas.";
    case "viewer":
      return "Vas a poder mirar los eventos y el equipo, sin hacer cambios.";
    default:
      return "Vas a poder trabajar sobre los eventos de la productora.";
  }
}

export function InvitacionEquipo({
  productora,
  email,
  rol,
  vence,
  link,
}: InvitacionEquipoProps) {
  return (
    <Html lang="es">
      <Body style={{ margin: 0, padding: 0, backgroundColor: SURFACE_0, color: FG, fontFamily: FONT_STACK }}>
        <Container style={{ maxWidth: "480px", margin: "0 auto", padding: "32px 20px" }}>
          <Encabezado />

          <Section
            style={{
              backgroundColor: SURFACE_1,
              border: `1px solid ${BORDER}`,
              padding: "28px 24px",
            }}
          >
            <Heading
              as="h1"
              style={{ margin: "0 0 18px 0", fontSize: "22px", lineHeight: 1.25, color: FG }}
            >
              {productora} te sumó a su equipo
            </Heading>

            <Text style={P}>
              Te invitaron a trabajar en los eventos de <strong>{productora}</strong> dentro
              de LABURO. {queHace(rol)}
            </Text>

            <Section
              style={{
                backgroundColor: SURFACE_2,
                border: `1px solid ${BORDER}`,
                padding: "14px 16px",
                margin: "0 0 18px 0",
              }}
            >
              <Text style={{ margin: 0, fontSize: "13px", lineHeight: 1.6, color: FG_MUTED }}>
                Entrá con esta dirección:
              </Text>
              <Text style={{ margin: "4px 0 0 0", fontSize: "15px", lineHeight: 1.5, color: FG }}>
                <strong>{email}</strong>
              </Text>
            </Section>

            <Button
              href={link}
              style={{
                display: "inline-block",
                backgroundColor: ACCENT,
                color: "#FFFFFF",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: 700,
                padding: "13px 26px",
              }}
            >
              Entrar al equipo
            </Button>

            {vence ? (
              <Text style={{ margin: "18px 0 0 0", fontSize: "13px", lineHeight: 1.6, color: FG_MUTED }}>
                El link vale hasta {vence}.
              </Text>
            ) : null}

            <Text style={{ margin: "14px 0 0 0", fontSize: "13px", lineHeight: 1.6, color: FG_MUTED }}>
              Si no esperabas esto, ignorá el mail: sin abrir el link no pasa nada.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
