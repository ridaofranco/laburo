/**
 * EL AVISO DE CÓMO TERMINÓ EL PEDIDO. Un solo componente, tres desenlaces.
 *
 * ── POR QUÉ ESTE MAIL EXISTE, QUE ES LA PARTE QUE SE SALTEA TODO EL MUNDO ────
 * Porque el que cotizó y nunca supo nada no te vuelve a cotizar. Avisar es lo
 * que sostiene la red: cuesta un mail y es la diferencia entre tener a quién
 * pedirle precio el mes que viene o volver a empezar de cero.
 *
 * Tres desenlaces, y son tres mails distintos a propósito:
 *
 *  · `gano`      — ganó. Lo primero que dice es eso, y después qué pasa ahora.
 *  · `no_gano`   — cotizó y no quedó. Sin vueltas, sin "lamentablemente" largo,
 *                  y SIN decirle por cuánto ganó el otro: ese número no es suyo,
 *                  y publicarlo es enseñarle a todos a cotizar contra un precio
 *                  en vez de contra su costo.
 *  · `sin_cotizar` — lo invitaron y no llegó a cotizar. **No es un reproche.**
 *                  Se cierra el círculo para que el próximo link no se ignore.
 *
 * ⚠️ NUNCA se dice cuántos cotizaron, ni quiénes eran, ni con qué números. Lo
 * ciego entre proveedores no termina cuando se adjudica: si el que perdió puede
 * deducir el precio del otro, el mecanismo se rompe para siempre.
 *
 * ⚠️ Y en `no_gano` no se promete trabajo futuro ("te tendremos en cuenta") si
 * no hay nada concreto. Es la frase que hace que el próximo mail se lea como
 * relleno.
 */

import {
  Body,
  Container,
  Heading,
  Html,
  Section,
  Text,
} from "@react-email/components";
import { Encabezado } from "./encabezado";

export type ResultadoCotizacion = "gano" | "no_gano" | "sin_cotizar";

export interface ResultadoCotizacionProps {
  nombre: string | null;
  productora: string;
  titulo: string;
  resultado: ResultadoCotizacion;
  /** Solo para el ganador: su propio monto, para que quede constancia. */
  montoTexto?: string | null;
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

const COPY: Record<
  ResultadoCotizacion,
  { etiqueta: string; titulo: string; cuerpo: (p: string, t: string) => string }
> = {
  gano: {
    etiqueta: "Quedaste seleccionado",
    titulo: "Tu presupuesto es el elegido",
    cuerpo: (p, t) =>
      `${p} eligió tu presupuesto para ${t}. Te van a escribir para coordinar los detalles y la forma de pago.`,
  },
  no_gano: {
    etiqueta: "Se cerró el pedido",
    titulo: "Esta vez no quedó el tuyo",
    cuerpo: (p, t) =>
      `${p} ya eligió para ${t}, y esta vez no quedó tu presupuesto. Gracias por tomarte el trabajo de cotizar: sin tu número no había con qué comparar.`,
  },
  sin_cotizar: {
    etiqueta: "Se cerró el pedido",
    titulo: "Se cerró el pedido de presupuesto",
    cuerpo: (p, t) =>
      `Se cerró el pedido de ${p} para ${t} y no llegamos a recibir tu presupuesto. Te avisamos igual para que sepas que quedó resuelto y no te quede el link abierto.`,
  },
};

export function ResultadoCotizacionEmail({
  nombre,
  productora,
  titulo,
  resultado,
  montoTexto,
}: ResultadoCotizacionProps) {
  const c = COPY[resultado];
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
              {c.etiqueta}
            </Text>

            <Heading
              as="h1"
              style={{ margin: "0 0 16px 0", fontSize: "22px", lineHeight: 1.25, fontWeight: 700, color: FG }}
            >
              {c.titulo}
            </Heading>

            <Text style={P}>{saludo},</Text>
            <Text style={P}>{c.cuerpo(productora, titulo)}</Text>

            {resultado === "gano" && montoTexto ? (
              <Text style={{ ...P, color: FG_MUTED }}>
                El presupuesto elegido es el que cargaste por{" "}
                <strong style={{ color: FG }}>{montoTexto}</strong>, con lo que dijiste
                que incluye. Si algo cambió, avisales antes de arrancar.
              </Text>
            ) : null}

            {resultado !== "gano" ? (
              <Text style={{ ...P, color: FG_MUTED }}>
                Cuando aparezca otro pedido de tu rubro te llega un mail como este, con su
                propio link.
              </Text>
            ) : null}

            <Text style={{ margin: "16px 0 0 0", fontSize: "13px", lineHeight: 1.5, color: FG_MUTED }}>
              Si querés decirles algo, respondé este mail y les llega.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
