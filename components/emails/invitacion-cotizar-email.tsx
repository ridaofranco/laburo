/**
 * LA INVITACIÓN A COTIZAR. Es el mail del que salen, o no salen, los precios.
 *
 * ── DE DÓNDE SALE CADA DECISIÓN DE ESTE MAIL ────────────────────────────────
 * Del caso real: un pallet a siete destinos, 370 correos, 45 respuestas y solo
 * 2 con un precio adentro. Las 43 restantes eran preguntas. Este mail está
 * escrito para que la respuesta sea un número y no una repregunta.
 *
 * 1. **QUÉ, DÓNDE Y PARA CUÁNDO VAN EN EL MAIL, no atrás del link.** El que
 *    recibe esto decide en cinco segundos, mirando el teléfono, si le sirve.
 *    Un mail que dice "entrá a ver" pierde ahí mismo a la mitad.
 *
 * 2. **LA FECHA DE CIERRE ESTÁ Y ES CONCRETA.** Sin fecha, cotizar es algo que
 *    se hace mañana. Es también lo único que después justifica el recordatorio.
 *
 * 3. **DICE QUE NO HACE FALTA REGISTRARSE.** Es la objeción número uno de una
 *    empresa que nunca escuchó hablar de LABURO, y si no está contestada arriba
 *    el link no se abre.
 *
 * 4. **DICE QUE NADIE MÁS VE SU PRECIO.** Un proveedor que sospecha que su
 *    número queda expuesto cotiza alto o no cotiza.
 *
 * 5. **NO DICE A CUÁNTOS MÁS SE LES PIDIÓ.** Ni "te elegimos entre varios" ni
 *    "estás compitiendo con otros". Saber que sos uno de doce cambia el precio,
 *    y encima nunca es del todo cierto en el momento en que se manda.
 *
 * El asunto lo arma quien envía e incluye el rubro y quién pide: en la casilla
 * de un proveedor compite con veinte mails más.
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

export interface InvitacionCotizarProps {
  /** Cómo se llama el invitado, si lo sabemos. */
  nombre: string | null;
  /** La productora que pide. El que cotiza SÍ ve quién le pide (decisión 2). */
  productora: string;
  titulo: string;
  descripcion: string | null;
  categoria: string | null;
  donde: string | null;
  /** "para el 25 de septiembre", ya formateado. */
  necesarioPara: string | null;
  /** "el martes 10 de septiembre a las 18:00", ya formateado. */
  cierra: string;
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
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

const P = { margin: "0 0 14px 0", fontSize: "15px", lineHeight: 1.65, color: FG } as const;

function Dato({ label, value }: { label: string; value: string | null }) {
  const v = (value ?? "").trim();
  if (!v) return null;
  return (
    <Text style={{ margin: "0 0 10px 0", fontSize: "15px", lineHeight: 1.5, color: FG }}>
      <span style={{ color: FG_MUTED }}>{label}: </span>
      {v}
    </Text>
  );
}

export function InvitacionCotizar({
  nombre,
  productora,
  titulo,
  descripcion,
  categoria,
  donde,
  necesarioPara,
  cierra,
  link,
}: InvitacionCotizarProps) {
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
              Te piden un presupuesto
            </Text>

            <Heading
              as="h1"
              style={{ margin: "0 0 8px 0", fontSize: "22px", lineHeight: 1.25, fontWeight: 700, color: FG }}
            >
              {saludo}
            </Heading>

            <Text style={P}>
              <strong style={{ color: FG }}>{productora}</strong> te está pidiendo precio
              para lo siguiente.
            </Text>

            {/* Los datos, en el mail. No atrás del link: el que recibe esto
                decide en cinco segundos si le sirve. */}
            <Section
              style={{
                backgroundColor: SURFACE_2,
                border: `1px solid ${BORDER}`,
                padding: "18px 18px 8px 18px",
                margin: "6px 0 18px 0",
              }}
            >
              <Dato label="Qué" value={titulo} />
              <Dato label="Rubro" value={categoria} />
              <Dato label="Dónde" value={donde} />
              <Dato label="Para cuándo" value={necesarioPara} />
              <Dato label="Detalle" value={descripcion} />
            </Section>

            <Text style={{ ...P, color: FG }}>
              <strong style={{ color: FG }}>Podés cargarlo hasta el {cierra}.</strong>{" "}
              Después de esa fecha la pantalla se cierra sola.
            </Text>

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

            <Text style={{ margin: "0 0 10px 0", fontSize: "14px", lineHeight: 1.6, color: FG_MUTED }}>
              <strong style={{ color: FG }}>No hace falta registrarse ni crear una
              cuenta.</strong> El link es tuyo: se abre directo y podés corregir el precio
              las veces que quieras hasta que cierre.
            </Text>

            <Text style={{ margin: "0 0 10px 0", fontSize: "14px", lineHeight: 1.6, color: FG_MUTED }}>
              Tu precio no lo ve nadie más que {productora}. Ningún otro proveedor puede
              verlo.
            </Text>

            <Text style={{ margin: "16px 0 0 0", fontSize: "13px", lineHeight: 1.5, color: FG_MUTED }}>
              Si el botón no abre, copiá y pegá esta dirección en el navegador: {link}
            </Text>

            <Text style={{ margin: "14px 0 0 0", fontSize: "13px", lineHeight: 1.5, color: FG_MUTED }}>
              ¿Te falta un dato para poder cotizar? Respondé este mail y te contestan.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
