/**
 * "¿QUERÉS QUE OTRAS PRODUCTORAS TE VEAN?" — el mail del consentimiento.
 *
 * ── POR QUÉ ESTE MAIL EXISTE ────────────────────────────────────────────────
 * Las 1.050 personas del pool se anotaron en el formulario de SOMOS DER.
 * Consintieron que SOMOS DER tenga sus datos para convocarlas a SUS eventos.
 * No consintieron aparecer en un catálogo que miran otras productoras.
 *
 * Abrir el pool cambia quién trata sus datos, y eso no se arregla con un
 * término de uso nuevo. El consentimiento se pide antes, no después: este mail
 * es esa pregunta.
 *
 * ── LAS TRES REGLAS DEL COPY, Y NINGUNA ES ESTÉTICA ─────────────────────────
 *
 * 1. **Las dos respuestas pesan lo mismo.** Acá no hay un botón "sí" grande y
 *    un "no" chiquito en gris: hay UN botón que abre la pantalla donde las dos
 *    opciones son iguales. Un mail que empuja al sí convierte la pregunta en un
 *    embudo, y entonces la respuesta no sirve como consentimiento: sirve como
 *    estadística de diseño.
 *
 * 2. **El mail dice qué pasa si no contesta, y dice la verdad: no pasa nada.**
 *    Si el silencio tuviera costo, no sería una pregunta. Es lo único que hace
 *    que esto sea un consentimiento y no un aviso.
 *
 * 3. **Dice qué se comparte y qué no, con esas palabras.** Se comparte la ficha
 *    profesional. No se comparte el teléfono, ni el mail, ni el documento. Si
 *    eso no está escrito, la persona contesta sobre otra cosa.
 *
 * ⚠️ NO ESCRIBIR QUE LA PERSONA ES PARTE DEL EQUIPO DE SOMOS DER (riesgo legal,
 * decisión de Franco): quien está en LABURO no es empleado, es alguien que dejó
 * su ficha y puede recibir propuestas para eventos puntuales.
 *
 * ⚠️ Y NO PROMETER TRABAJO. "Te van a llegar más propuestas" no lo podemos
 * sostener: hoy no hay una sola productora cliente operando. Lo honesto es "más
 * productoras pueden encontrarte", que es exactamente lo que cambia.
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

export interface VisibilidadEmailProps {
  firstName: string;
  link: string;
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

const P = { margin: "0 0 14px 0", fontSize: "15px", lineHeight: 1.65, color: FG } as const;
const P_MUT = { ...P, color: FG_MUTED } as const;
const SUB = {
  margin: "22px 0 10px 0",
  fontSize: "13px",
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
  color: FG,
  fontWeight: 700,
} as const;

/** Ítem de lista. El · va aparte para no depender de <ul>, que varios clientes
 *  de correo renderizan con sangrías raras. */
function Item({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ margin: "0 0 10px 0", fontSize: "15px", lineHeight: 1.6, color: FG_MUTED }}>
      <span style={{ color: ACCENT, fontWeight: 700 }}>· </span>
      {children}
    </Text>
  );
}

export function VisibilidadEmail({ firstName, link, bajaLink }: VisibilidadEmailProps) {
  const saludo = firstName?.trim()
    ? `${firstName.trim()}, te queremos preguntar una cosa`
    : "Te queremos preguntar una cosa";

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
              Una pregunta sobre tu ficha
            </Text>

            <Heading
              as="h1"
              style={{ margin: "0 0 18px 0", fontSize: "22px", lineHeight: 1.25, fontWeight: 700, color: FG }}
            >
              {saludo}
            </Heading>

            <Text style={P}>
              Te escribimos de SOMOS DER. En algún momento dejaste tus datos para trabajar
              con nosotros en eventos, y desde entonces tu ficha vive en{" "}
              <strong style={{ color: FG }}>LABURO</strong>, que es donde manejamos la
              convocatoria. Hasta hoy la vemos nosotros y nadie más.
            </Text>

            <Text style={P}>
              Queremos abrirlo a otras productoras del país, para que tu ficha te sirva
              para trabajar con varias y no solo con nosotros. Eso cambia quién puede ver
              tus datos, así que no lo hacemos sin preguntarte.
            </Text>

            <Text style={SUB}>Qué verían</Text>
            <Item>
              Tu ficha profesional: nombre, oficio, experiencia, formación, provincia y
              disponibilidad.
            </Item>
            <Item>
              <strong style={{ color: FG }}>No</strong> tu teléfono, tu mail ni tu
              documento. El contacto sigue pasando por la plataforma.
            </Item>
            <Item>
              Solo productoras registradas, no cualquiera que entre a internet. Tu ficha no
              se publica en una página abierta.
            </Item>

            <Text style={SUB}>Si decís que no</Text>
            <Text style={P}>
              Tu ficha se queda como está hoy, la vemos solo nosotros, y seguís recibiendo
              nuestras propuestas exactamente igual. No perdés nada.
            </Text>

            <Text style={P}>
              <strong style={{ color: FG }}>Y si no contestás, tampoco pasa nada:</strong>{" "}
              sin una respuesta tuya no compartimos nada. El silencio lo tomamos como un
              no.
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
                Responder
              </Button>
            </Section>

            <Text style={{ margin: "18px 0 0 0", fontSize: "13px", lineHeight: 1.5, color: FG_MUTED }}>
              Se abre una pantalla con las dos opciones. Podés cambiar de opinión cuando
              quieras, con este mismo link. Si el botón no abre, copiá y pegá esta
              dirección en el navegador: {link}
            </Text>

            <Text style={{ ...P_MUT, marginTop: "18px", marginBottom: 0 }}>
              Si tenés alguna duda antes de contestar, respondé este mail y lo leemos.
            </Text>
          </Section>

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
