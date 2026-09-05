/**
 * "ESTO CIERRA PRONTO" — el recordatorio al que no cotizó.
 *
 * Sobre 370 correos, este mail probablemente valga más que todo el resto del
 * producto junto: la diferencia entre 2 respuestas y 6 no es una pantalla más
 * linda, es acordarse de avisar antes de que cierre.
 *
 * ── LAS TRES REGLAS DEL RECORDATORIO ────────────────────────────────────────
 *
 * 1. **NO reprocha.** Nada de "todavía no recibimos tu respuesta". El que no
 *    cotizó no hizo nada malo: estaba trabajando. El mail avisa que queda poco
 *    tiempo, y ya.
 *
 * 2. **Repite QUÉ es**, no manda a buscar el mail anterior. El proveedor recibe
 *    cuarenta mails por día: "te recordamos lo que te pedimos" no le dice nada
 *    si no está el qué al lado.
 *
 * 3. **Trae su propio botón**, con un token nuevo (0080). El del primer mail no
 *    se puede reconstruir porque de él solo queda el sha256, y un recordatorio
 *    sin link pierde a la mitad justo cuando más importa. Los dos links valen a
 *    la vez, así que el mail viejo tampoco se rompe.
 *
 * Y dice cuánto falta en horas o días, no solo la fecha: "cierra mañana a las
 * 18" mueve, "cierra el 10/09 18:00" se archiva.
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

export interface RecordatorioCotizarProps {
  nombre: string | null;
  productora: string;
  titulo: string;
  categoria: string | null;
  donde: string | null;
  /** "mañana a las 18:00" o "el martes 10 de septiembre a las 18:00". */
  cuandoCierra: string;
  link: string | null;
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

const P = { margin: "0 0 14px 0", fontSize: "15px", lineHeight: 1.65, color: FG } as const;

export function RecordatorioCotizar({
  nombre,
  productora,
  titulo,
  categoria,
  donde,
  cuandoCierra,
  link,
}: RecordatorioCotizarProps) {
  const saludo = nombre?.trim() ? `Hola ${nombre.trim()}` : "Hola";

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
            <Text
              style={{
                margin: "0 0 10px 0",
                fontSize: "11px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: ACCENT,
              }}
            >
              Cierra {cuandoCierra}
            </Text>

            <Heading
              as="h1"
              style={{ margin: "0 0 16px 0", fontSize: "22px", lineHeight: 1.25, fontWeight: 700, color: FG }}
            >
              {saludo}, queda poco para mandar tu precio
            </Heading>

            <Text style={P}>
              El pedido de <strong style={{ color: FG }}>{productora}</strong> cierra{" "}
              {cuandoCierra}, y todavía estás a tiempo.
            </Text>

            <Section
              style={{
                backgroundColor: SURFACE_2,
                border: `1px solid ${BORDER}`,
                padding: "16px 18px",
                margin: "6px 0 18px 0",
              }}
            >
              <Text style={{ margin: "0 0 6px 0", fontSize: "16px", lineHeight: 1.4, color: FG }}>
                {titulo}
              </Text>
              {categoria || donde ? (
                <Text style={{ margin: 0, fontSize: "14px", lineHeight: 1.5, color: FG_MUTED }}>
                  {[categoria, donde].filter(Boolean).join(" · ")}
                </Text>
              ) : null}
            </Section>

            {link ? (
              <Section style={{ margin: "22px 0" }}>
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
                  }}
                >
                  Cargar mi presupuesto
                </Button>
              </Section>
            ) : null}

            <Text style={{ margin: "0 0 10px 0", fontSize: "14px", lineHeight: 1.6, color: FG_MUTED }}>
              Son dos minutos: el precio, qué incluye y qué no. No hace falta crear
              ninguna cuenta.
            </Text>

            <Text style={{ margin: "0 0 10px 0", fontSize: "14px", lineHeight: 1.6, color: FG_MUTED }}>
              Si no vas a cotizar, no hace falta que hagas nada. Y si te falta un dato,
              respondé este mail.
            </Text>

            {link ? (
              <Text style={{ margin: "16px 0 0 0", fontSize: "13px", lineHeight: 1.5, color: FG_MUTED }}>
                Si el botón no abre: {link}
              </Text>
            ) : null}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
