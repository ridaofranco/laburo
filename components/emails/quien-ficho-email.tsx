/**
 * Email INTERNO "QUIÉN FICHÓ": el resumen de asistencia de un evento terminado,
 * para la productora/admin (MAIL_ADMIN_TO). Molde de offer-answer-email (mismo
 * esqueleto de marca, self-contained).
 *
 * PARA QUÉ: el fichaje con geofencing existe y junta los datos (entrada, salida,
 * distancia al predio), pero nadie los mira: para saber quién vino hay que
 * entrar a la app evento por evento. Este mail llega solo a la mañana siguiente
 * con las dos listas que importan:
 *   1. Quién fichó, con horarios y un aviso si fichó LEJOS del predio (el
 *      geofencing marca, no bloquea: la decisión es del productor).
 *   2. Quién estaba confirmado y NO fichó, que es la fila que más duele y la
 *      primera que hay que ver.
 *
 * Copy en voseo, sin em dash. Los nombres vienen del pool y react-email los
 * escapa en los children: nunca HTML crudo.
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

export interface FichadaRow {
  nombre: string;
  role?: string | null;
  /** "14:02" o null si no quedó registrada (fichó salida sin entrada no pasa). */
  entrada?: string | null;
  /** "22:30" o null si no fichó la salida. */
  salida?: string | null;
  /** Metros al predio al fichar. null = el gig no tenía ubicación cargada. */
  distanciaM?: number | null;
}

export interface QuienFichoEmailProps {
  gigTitle: string;
  whenText?: string | null;
  venue?: string | null;
  ficharon: FichadaRow[];
  sinFichar: Array<{ nombre: string; role?: string | null }>;
  link: string;
}

const SURFACE_0 = "#000000";
const SURFACE_1 = "#0A0A0A";
const BORDER = "#1A1A1A";
const ACCENT = "#0047FF";
const FG = "#F5F5F5";
const FG_MUTED = "#8A8A8A";
const OK = "#3DD68C";
const WARN = "#F5A623";
const BAD = "#FFB4AB";

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

/** A partir de cuántos metros el fichaje se marca como "lejos del predio". */
const LEJOS_M = 500;

function distanciaTexto(m?: number | null): string | null {
  if (m == null || m < LEJOS_M) return null;
  return m >= 1000 ? `fichó a ${(m / 1000).toFixed(1)} km del predio` : `fichó a ${Math.round(m)} m del predio`;
}

export function QuienFichoEmail({
  gigTitle,
  whenText,
  venue,
  ficharon,
  sinFichar,
  link,
}: QuienFichoEmailProps) {
  const total = ficharon.length + sinFichar.length;

  return (
    <Html lang="es">
      <Body style={{ margin: 0, padding: 0, backgroundColor: SURFACE_0, color: FG, fontFamily: FONT_STACK }}>
        <Container style={{ maxWidth: "480px", margin: "0 auto", padding: "32px 20px" }}>
          <Encabezado bajada="Aviso interno · resumen de fichaje" />
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
              Quién fichó
            </Text>

            <Heading
              as="h1"
              style={{ margin: "0 0 8px 0", fontSize: "22px", lineHeight: 1.25, fontWeight: 700, color: FG }}
            >
              {gigTitle}
            </Heading>

            {(whenText || venue) ? (
              <Text style={{ margin: "0 0 16px 0", fontSize: "14px", lineHeight: 1.5, color: FG_MUTED }}>
                {[whenText, venue].filter(Boolean).join(" · ")}
              </Text>
            ) : null}

            <Text style={{ margin: "0 0 18px 0", fontSize: "15px", lineHeight: 1.6, color: FG }}>
              Ficharon {ficharon.length} de {total} confirmados.
            </Text>

            {/* Los que NO ficharon van PRIMERO: es la fila que hay que ver. */}
            {sinFichar.length > 0 ? (
              <>
                <Text
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: "11px",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: BAD,
                  }}
                >
                  Sin fichar ({sinFichar.length})
                </Text>
                {sinFichar.map((p, i) => (
                  <Text
                    key={`s${i}`}
                    style={{ margin: "0 0 6px 0", fontSize: "15px", lineHeight: 1.5, color: FG }}
                  >
                    {p.nombre}
                    {p.role?.trim() ? (
                      <span style={{ color: FG_MUTED }}> · {p.role.trim()}</span>
                    ) : null}
                  </Text>
                ))}
                <Text style={{ margin: "4px 0 18px 0", fontSize: "12px", lineHeight: 1.5, color: FG_MUTED }}>
                  Sin fichar no siempre es sin venir: puede haber estado y no
                  marcar. Vale confirmarlo antes de decidir el pago.
                </Text>
              </>
            ) : null}

            {ficharon.length > 0 ? (
              <>
                <Text
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: "11px",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: OK,
                  }}
                >
                  Ficharon ({ficharon.length})
                </Text>
                {ficharon.map((p, i) => {
                  const lejos = distanciaTexto(p.distanciaM);
                  return (
                    <Text
                      key={`f${i}`}
                      style={{ margin: "0 0 6px 0", fontSize: "15px", lineHeight: 1.5, color: FG }}
                    >
                      {p.nombre}
                      {p.role?.trim() ? (
                        <span style={{ color: FG_MUTED }}> · {p.role.trim()}</span>
                      ) : null}
                      <span style={{ color: FG_MUTED }}>
                        {" "}· {p.entrada ?? "?"}
                        {p.salida ? ` a ${p.salida}` : " (sin salida)"}
                      </span>
                      {lejos ? <span style={{ color: WARN }}> · {lejos}</span> : null}
                    </Text>
                  );
                })}
              </>
            ) : (
              <Text style={{ margin: "0", fontSize: "15px", lineHeight: 1.6, color: FG_MUTED }}>
                No fichó nadie. Si el evento se hizo, el equipo no está usando el
                fichaje: vale recordárselo en el próximo.
              </Text>
            )}

            <Section style={{ marginTop: "22px" }}>
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
                Ver el evento en el tablero
              </Button>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
