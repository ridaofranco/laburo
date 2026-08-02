/**
 * LA CONSULTA DE UN CLIENTE FINAL, QUE LE LLEGA AL PROVEEDOR A SU MAIL (Fase 4).
 *
 * Es el gemelo de consulta-proveedor-email.tsx, y existe separado por UNA razón
 * que no es cosmética: en aquel, el que consulta es una productora y el asunto
 * dice "tal productora te está pidiendo un presupuesto". Acá no hay productora
 * atrás. Es una persona que está organizando su propia fiesta.
 *
 * Esa diferencia le cambia el trabajo al proveedor y por eso se le avisa arriba
 * de todo:
 *   · No es un colega del rubro, así que no da por sabido nada. Va a preguntar
 *     cosas que una productora no pregunta.
 *   · Es la primera vez que compra esto y probablemente esté pidiéndole
 *     presupuesto a varios. El que contesta rápido y claro se lo lleva.
 *   · Nadie lo filtró antes. La consulta llegó porque su perfil está publicado.
 *
 * Se mantiene todo lo demás de la versión de la productora: contacto arriba de
 * todo (lo lee en el teléfono entre dos eventos), botón de responder resuelto con
 * el Reply-To del envío (todavía no hay una pantalla donde conteste adentro), y
 * las respuestas renderizadas con la etiqueta guardada, no con el formulario de
 * hoy.
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

export interface ConsultaClienteProps {
  /** Cómo se llama el proveedor, para saludarlo. */
  proveedor: string;
  /** Quién escribe. Acá es obligatorio: sin nombre no se manda la consulta. */
  nombre: string;
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

export function ConsultaCliente({
  proveedor,
  nombre,
  email,
  telefono,
  respuestas,
}: ConsultaClienteProps) {
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
              Consulta de un cliente
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
              {nombre} te está pidiendo un presupuesto
            </Heading>

            <Text style={{ margin: "0 0 20px 0", fontSize: "16px", lineHeight: 1.6, color: FG }}>
              Hola {proveedor}. Esta consulta no viene de una productora: la mandó
              una persona que está organizando su propio evento y encontró tu
              perfil en LABURO. Completó tu formulario, así que acá abajo está
              todo lo que te contó.
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
                {nombre}
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

            {/* Por qué se le dice esto y no un "gracias por usar LABURO": es la
             *  diferencia entre esta consulta y la de una productora, y es
             *  accionable. Una persona que organiza su fiesta pide tres
             *  presupuestos el mismo día. */}
            <Text style={{ margin: "0 0 12px 0", fontSize: "14px", lineHeight: 1.6, color: FG_MUTED }}>
              Un consejo: quien organiza su propia fiesta suele pedirle
              presupuesto a varios el mismo día y no conoce el rubro. Contestar
              rápido y con el precio claro es casi todo el trabajo.
            </Text>

            <Text style={{ margin: 0, fontSize: "13px", lineHeight: 1.5, color: FG_MUTED }}>
              Recibís esto porque tu perfil está publicado en el marketplace de
              LABURO. Las preguntas de arriba son las de tu formulario: si querés
              cambiarlas, o dejar de aparecer, entrá con tu link de proveedor.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
