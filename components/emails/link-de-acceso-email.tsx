/**
 * EL MAIL CON EL LINK PARA ENTRAR A LABURO.
 *
 * ── POR QUÉ EXISTE (2/9) ────────────────────────────────────────────────────
 * Hasta hoy el link para entrar lo mandaba Supabase con su propia plantilla, y
 * ese mail traía un `code` de PKCE. El `code` solo se puede canjear en el MISMO
 * navegador que lo pidió, porque el `code_verifier` queda guardado ahí. El caso
 * real y cotidiano: la persona pide el link desde el celular y lo abre desde el
 * visor interno de Gmail, que es otro navegador. Ahí no hay verifier, el canje
 * falla, y ve "ese link ya se usó o venció" con un link perfectamente válido.
 *
 * La salida obvia sería cambiar la plantilla de Supabase para que mande
 * `token_hash` en vez de `code`. Está PROHIBIDO: el proyecto de Supabase lo
 * comparten LABURO y HITO, y la plantilla es UNA sola por proyecto. Arreglaría
 * LABURO y rompería el login de HITO.
 *
 * Así que el link lo arma `admin.generateLink` (que devuelve el token sin mandar
 * nada) y viaja adentro de ESTE mail, que es nuestro. Es exactamente la misma
 * decisión que ya había tomado `lib/auth-link.ts` para el link de contraseña.
 * De yapa, el mail deja de estar en inglés y sin marca.
 *
 * Molde: welcome-email.tsx. Mismos tokens de marca inline y self-contained,
 * porque los clientes de correo ignoran el CSS externo.
 *
 * ⚠️ EL LINK ES UNA CREDENCIAL. Es de un solo uso y de vida corta (lo verifiqué:
 * el segundo canje del mismo token devuelve "Email link is invalid or has
 * expired"), pero mientras dure abre la cuenta. Por eso el texto lo dice, y por
 * eso este mail NUNCA se le manda a un mail que no lo pidió: los tres emisores
 * validan antes de llamar acá.
 *
 * IMPORTANTE para el que lo consume: en react-email v2 `render()` es ASYNC.
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
  /** El link con el `token_hash`, ya armado por lib/auth-link.ts. */
  link: string;
  /**
   * ⭐ DOS CARAS DEL MISMO MAIL, molde de `conLinkDeClave` en welcome-email.tsx.
   *
   * false (default) → el link ENTRA directo (/auth/callback). Es el de las dos
   *                   puertas, /entrar y /login.
   * true            → el link lleva a ELEGIR la contraseña
   *                   (/definir-contrasena/confirmar). Es el del botón "es mi
   *                   primera vez" de /acceso-staff.
   *
   * Existe como prop y no como dos componentes porque el mail es el mismo hecho
   * (te mandamos tu link) y separarlo garantiza que dentro de seis meses uno de
   * los dos tenga la marca vieja. Pero el texto SÍ tiene que cambiar: hasta el
   * 1/8 un mail de LABURO prometía "no hace falta contraseña" y mandaba a una
   * pantalla que pedía una, y una trabajadora real se registró dos veces por
   * eso. El copy no puede describir un flujo distinto del que el link abre.
   */
  paraElegirContrasena?: boolean;
}

// Tokens de marca (espejo de app/globals.css @theme, Radical Minimalist).
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
  paraElegirContrasena = false,
}: LinkDeAccesoEmailProps) {
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
              {paraElegirContrasena
                ? "Elegí tu contraseña"
                : "Entrá con este link"}
            </Heading>

            <Text
              style={{
                margin: "0 0 20px 0",
                fontSize: "16px",
                lineHeight: 1.6,
                color: FG,
              }}
            >
              {paraElegirContrasena
                ? "Pediste crear o cambiar tu contraseña de LABURO. Tocá el botón y elegila. Es una sola vez: después entrás siempre con este mismo mail y esa clave."
                : "Pediste entrar a LABURO con este mail. Tocá el botón y entrás directo, no hace falta que escribas ninguna contraseña."}
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
                {paraElegirContrasena ? "Elegir mi contraseña" : "Entrar a LABURO"}
              </Button>
            </Section>

            <Text
              style={{
                margin: "18px 0 0 0",
                fontSize: "14px",
                lineHeight: 1.5,
                color: FG_MUTED,
              }}
            >
              El link es tuyo, sirve una sola vez y por seguridad dura poco. Si
              ya venció, pedí uno nuevo desde la pantalla de acceso con este
              mismo mail.
            </Text>

            <Text
              style={{
                margin: "24px 0 0 0",
                fontSize: "13px",
                lineHeight: 1.5,
                color: FG_MUTED,
              }}
            >
              Si el botón no abre, copiá y pegá esta dirección en el navegador:{" "}
              {link}
            </Text>

            <Text
              style={{
                margin: "16px 0 0 0",
                fontSize: "13px",
                lineHeight: 1.5,
                color: FG_MUTED,
              }}
            >
              Si no lo pediste vos, ignorá este mail. Sin tocar el link no pasa
              nada.
            </Text>
          </Section>
          <PieWhatsApp mensaje="Hola, te escribo porque no puedo entrar a LABURO." />
        </Container>
      </Body>
    </Html>
  );
}
