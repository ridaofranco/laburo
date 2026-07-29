/**
 * Email de RECORDATORIO DE PERFIL INCOMPLETO. Molde de welcome-email.tsx
 * (mismos tokens de marca, self-contained).
 *
 * PARA QUÉ: la bienvenida invita a entrar a revisar el perfil; una parte entra
 * y otra deja el mail para después, para siempre. Este es el ÚNICO empujón
 * extra (exactly-once en la 0034: un recordatorio por ficha, jamás un goteo),
 * unos días después, para los que todavía no entraron.
 *
 * EL ÁNGULO DEL COPY: no es un reto ni un "te olvidaste". Es el interés de la
 * persona: un perfil confirmado y completo es lo que hace que la llamemos para
 * el evento que le corresponde. Sin eso, las propuestas le pasan de largo.
 *
 * ⚠️ Mismas reglas duras que la bienvenida: voseo, sin em dash, y NADA de
 * "sos parte del equipo" (riesgo legal, decisión de Franco 26/7): la persona
 * está en la base y puede recibir propuestas para eventos puntuales, punto.
 *
 * NO LLEVA CREDENCIAL: el link es /acceso-staff, donde pide su propio link
 * mágico con su mail. Reenviado o filtrado, este mail no abre nada.
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

export interface PerfilReminderEmailProps {
  firstName: string;
  link: string;
  /** Link de baja del pool: mail de tanda, va SIEMPRE con salida a un click. */
  bajaLink?: string;
}

const SURFACE_0 = "#000000";
const SURFACE_1 = "#0A0A0A";
const BORDER = "#1A1A1A";
const ACCENT = "#0047FF";
const FG = "#F5F5F5";
const FG_MUTED = "#8A8A8A";

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

export function PerfilReminderEmail({ firstName, link, bajaLink }: PerfilReminderEmailProps) {
  const saludo = firstName?.trim() ? `${firstName.trim()}, tu` : "Tu";

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
              Tu perfil te espera
            </Text>

            <Heading
              as="h1"
              style={{ margin: "0 0 16px 0", fontSize: "22px", lineHeight: 1.25, fontWeight: 700, color: FG }}
            >
              {saludo} perfil de LABURO sigue sin revisar
            </Heading>

            <Text style={{ margin: "0 0 14px 0", fontSize: "16px", lineHeight: 1.6, color: FG }}>
              Hace unos días te contamos que tu perfil ya está en LABURO, la
              plataforma con la que armamos el staff de nuestros eventos.
              Todavía no entraste a revisarlo, y ahí hay laburo que te podés
              estar perdiendo.
            </Text>

            <Text style={{ margin: "0 0 20px 0", fontSize: "16px", lineHeight: 1.6, color: FG_MUTED }}>
              Cuando buscamos gente para un evento, filtramos por oficio, zona y
              disponibilidad. Un perfil revisado y completo aparece primero; uno
              a medias queda atrás aunque la persona sea la indicada. Entrar
              lleva dos minutos: ponés tu mail y te mandamos el link, sin
              contraseña.
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
                Revisar mi perfil
              </Button>
            </Section>

            <Text style={{ margin: "24px 0 0 0", fontSize: "13px", lineHeight: 1.5, color: FG_MUTED }}>
              Si el botón no abre, copiá y pegá esta dirección en el navegador:{" "}
              {link}
            </Text>

            <Text style={{ margin: "16px 0 0 0", fontSize: "13px", lineHeight: 1.5, color: FG_MUTED }}>
              Este es el único recordatorio que te mandamos por esto. Si ya
              entraste con otro mail, ignoralo tranquilo/a.
            </Text>
          </Section>
          <PieWhatsApp mensaje="Hola, te escribo por mi perfil de LABURO." />

          {bajaLink ? (
            <Text
              style={{
                margin: "8px 0 0 0",
                textAlign: "center",
                fontSize: "12px",
                lineHeight: 1.6,
                color: FG_MUTED,
              }}
            >
              Si no querés formar parte, te sacamos en un click:{" "}
              <a href={bajaLink} style={{ color: FG_MUTED, textDecoration: "underline" }}>
                darme de baja
              </a>
            </Text>
          ) : null}
        </Container>
      </Body>
    </Html>
  );
}
