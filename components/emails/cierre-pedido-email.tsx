/**
 * "TU PEDIDO DE PRECIO CERRÓ" — el aviso a quien hizo el pedido (0098).
 *
 * Antes, un pedido que llegaba a su fecha de cierre quedaba en silencio: el de
 * equipo del 11/9 venció vacío y nadie se enteró, y el de catering juntó 3
 * presupuestos reales que nadie eligió. La pantalla ya dice «Venció sin
 * presupuestos» o «Falta elegir» desde el 28/10, pero solo si alguien entra.
 *
 * Dos casos, un solo mail:
 * - Llegaron presupuestos → cuántos, y el botón para compararlos y elegir. Al
 *   elegir, LABURO les avisa a todos (al que ganó y a los demás).
 * - No llegó ninguno → qué se puede hacer desde la misma pantalla: darle más
 *   tiempo (con el pedido abierto de nuevo se suman invitados) o cancelarlo.
 */

import {
  Body,
  Button,
  Container,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { Encabezado } from "./encabezado";

export interface CierrePedidoProps {
  titulo: string;
  categoria: string | null;
  productora: string;
  /** A cuántos les salió la invitación. */
  invitados: number;
  /** Cuántos mandaron presupuesto. */
  cotizaron: number;
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

export function asuntoCierrePedido(titulo: string, cotizaron: number): string {
  const t = titulo.trim() || "tu pedido de precio";
  if (cotizaron === 0) return `Cerró sin presupuestos · ${t}`;
  return cotizaron === 1
    ? `Llegó 1 presupuesto: falta elegir · ${t}`
    : `Llegaron ${cotizaron} presupuestos: falta elegir · ${t}`;
}

export function CierrePedido({
  titulo,
  categoria,
  productora,
  invitados,
  cotizaron,
  link,
}: CierrePedidoProps) {
  const hay = cotizaron > 0;

  return (
    <Html lang="es">
      <Preview>{hay
        ? `Cotizaron ${cotizaron} de ${invitados}. Compará los presupuestos y elegí.`
        : "No llegó ningún presupuesto. Podés darle más tiempo o cancelarlo."}</Preview>
      <Body style={{ margin: 0, padding: 0, backgroundColor: SURFACE_0, color: FG, fontFamily: FONT_STACK }}>
        <Container style={{ maxWidth: "480px", margin: "0 auto", padding: "32px 20px" }}>
          <Encabezado bajada="Pedidos de precio · LABURO" />
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
              Cerró tu pedido de precio
            </Text>

            <Heading
              as="h1"
              style={{ margin: "0 0 16px 0", fontSize: "22px", lineHeight: 1.25, fontWeight: 700, color: FG }}
            >
              {hay
                ? cotizaron === 1
                  ? "Llegó 1 presupuesto. Falta elegir."
                  : `Llegaron ${cotizaron} presupuestos. Falta elegir.`
                : "Cerró sin presupuestos"}
            </Heading>

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
              <Text style={{ margin: 0, fontSize: "14px", lineHeight: 1.5, color: FG_MUTED }}>
                {[categoria, productora].filter(Boolean).join(" · ")}
              </Text>
            </Section>

            {hay ? (
              <>
                <Text style={P}>
                  {invitados > 0
                    ? `Le llegó a ${invitados} ${invitados === 1 ? "proveedor" : "proveedores"} y ${
                        cotizaron === 1 ? "cotizó 1" : `cotizaron ${cotizaron}`
                      }. `
                    : ""}
                  En la pantalla del pedido los tenés uno al lado del otro, con qué incluye cada
                  uno, para comparar y elegir.
                </Text>
                <Text style={{ margin: "0 0 10px 0", fontSize: "14px", lineHeight: 1.6, color: FG_MUTED }}>
                  Cuando elijas, LABURO les avisa a todos: al que ganó y a los demás. Si
                  querés esperar a alguien más, desde ahí también le das unos días más.
                </Text>
              </>
            ) : (
              <>
                <Text style={P}>
                  {invitados > 0
                    ? `Le llegó a ${invitados} ${invitados === 1 ? "proveedor" : "proveedores"} y nadie mandó precio antes del cierre.`
                    : "No llegó a salir ninguna invitación antes del cierre."}
                </Text>
                <Text style={{ margin: "0 0 10px 0", fontSize: "14px", lineHeight: 1.6, color: FG_MUTED }}>
                  Desde la pantalla del pedido podés darle unos días más: los links de los
                  invitados vuelven a andar y podés sumar más proveedores. Si el trabajo ya no
                  va, cancelalo.
                </Text>
              </>
            )}

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
                {hay ? "Comparar y elegir" : "Ver el pedido"}
              </Button>
            </Section>

            <Text style={{ margin: "16px 0 0 0", fontSize: "13px", lineHeight: 1.5, color: FG_MUTED }}>
              Si el botón no abre: {link}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
