/**
 * LA CONSULTA QUE LE LLEGA AL PROVEEDOR A SU MAIL.
 *
 * Es el mail que reemplaza al WhatsApp de la Fase 3 (decisión de Franco, 2/8).
 * La diferencia entera está en el cuerpo: antes recibía "hola, te escribo por un
 * evento" y ahora recibe qué evento, qué día, dónde y para cuánta gente, o sea
 * todo lo que necesita para poder cotizar sin una sola repregunta.
 *
 * ── LAS TRES DECISIONES DEL MAIL ──
 *
 * 1. LOS DATOS DE CONTACTO VAN ARRIBA DE TODO, no al pie. El proveedor está
 *    leyendo esto en el teléfono entre dos eventos: si tiene que scrollear para
 *    saber a quién le contesta, no contesta.
 *
 * 2. EL BOTÓN ES "RESPONDER", no un link a LABURO. Todavía no existe una
 *    pantalla donde el proveedor conteste una consulta, así que mandarlo a la
 *    app sería mandarlo a la nada. El Server Action manda el mail con Reply-To
 *    apuntando a quien consultó, así que apretar responder en su cliente de
 *    correo ya le escribe a la persona correcta.
 *
 * 3. LAS RESPUESTAS SE RENDERIZAN CON LA ETIQUETA GUARDADA, no con el formulario
 *    de hoy. Si el proveedor cambia sus preguntas mañana, este mail sigue
 *    diciendo lo que se preguntó cuando se preguntó.
 *
 * Nada de em dash (regla dura de Franco).
 */

import {
  Body,
  Container,
  Heading,
  Hr,
  Html,
  Link,
  Section,
  Text,
} from "@react-email/components";
import { Encabezado } from "./encabezado";
import type { RespuestaConsulta } from "@/lib/formulario-consulta";

export interface ConsultaProveedorProps {
  /** Cómo se llama el proveedor, para saludarlo. */
  proveedor: string;
  /** La productora que consulta. */
  productora: string;
  /** Quién escribe, si dejó su nombre. */
  nombre: string | null;
  /** A dónde contestarle. Va también en el Reply-To del envío. */
  email: string;
  telefono: string | null;
  respuestas: RespuestaConsulta[];
}

const SURFACE_0 = "#000000";
const SURFACE_1 = "#0A0A0A";
const SURFACE_2 = "#121212";
const BORDER = "#1A1A1A";
const ACCENT = "#0047FF";
const FG = "#F5F5F5";
const FG_MUTED = "#8A8A8A";
const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

export function ConsultaProveedor({
  proveedor,
  productora,
  nombre,
  email,
  telefono,
  respuestas,
}: ConsultaProveedorProps) {
  const quien = nombre?.trim() || productora;

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
          <Encabezado bajada="Proveedores · SOMOS DER" />

          <Section
            style={{
              backgroundColor: SURFACE_1,
              border: `1px solid ${BORDER}`,
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
              Te llegó una consulta
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
              {productora} te está pidiendo un presupuesto
            </Heading>

            <Text style={{ margin: "0 0 20px 0", fontSize: "16px", lineHeight: 1.6, color: FG }}>
              Hola {proveedor}. Te encontraron en LABURO y completaron tu
              formulario. Acá está todo lo que te contaron.
            </Text>

            {/* Contacto arriba: es lo primero que necesita para poder responder. */}
            <Section
              style={{
                backgroundColor: SURFACE_2,
                border: `1px solid ${BORDER}`,
                padding: "16px 18px",
                marginBottom: "24px",
              }}
            >
              <Text
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "11px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: FG_MUTED,
                }}
              >
                Contestale a
              </Text>
              <Text style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 600, color: FG }}>
                {quien}
              </Text>
              <Text style={{ margin: "0 0 2px 0", fontSize: "15px", color: FG }}>
                <Link href={`mailto:${email}`} style={{ color: ACCENT, textDecoration: "none" }}>
                  {email}
                </Link>
              </Text>
              {telefono?.trim() ? (
                <Text style={{ margin: 0, fontSize: "15px", color: FG }}>{telefono}</Text>
              ) : null}
              <Text style={{ margin: "10px 0 0 0", fontSize: "13px", lineHeight: 1.5, color: FG_MUTED }}>
                Con apretar responder en este mismo mail ya le escribís.
              </Text>
            </Section>

            <Hr style={{ borderColor: BORDER, margin: "0 0 20px 0" }} />

            {respuestas.map((r, i) => (
              <Section key={i} style={{ marginBottom: "16px" }}>
                <Text
                  style={{
                    margin: "0 0 4px 0",
                    fontSize: "11px",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: FG_MUTED,
                  }}
                >
                  {r.label}
                </Text>
                <Text
                  style={{
                    margin: 0,
                    fontSize: "16px",
                    lineHeight: 1.55,
                    color: FG,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {r.valor}
                </Text>
              </Section>
            ))}

            <Hr style={{ borderColor: BORDER, margin: "24px 0 16px 0" }} />

            <Text style={{ margin: 0, fontSize: "13px", lineHeight: 1.5, color: FG_MUTED }}>
              Recibís esto porque tu perfil está publicado en el marketplace de
              LABURO. Las preguntas de arriba son las de tu formulario: si querés
              cambiarlas, entrá con tu link de proveedor.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
