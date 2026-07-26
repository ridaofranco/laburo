/**
 * PIE CON WHATSAPP, compartido por todos los mails de LABURO.
 *
 * Pedido de Franco (26/7): en TODAS las comunicaciones tiene que estar el
 * WhatsApp para poder atender cualquier inquietud. Antes el pie era solo la
 * línea "SOMOS DER · Staff para eventos": si a alguien le quedaba una duda sobre
 * una propuesta de trabajo, no tenía a dónde escribir salvo responder el mail,
 * que nadie hace desde el celular.
 *
 * Logo OFICIAL de WhatsApp, nunca un ícono genérico (regla dura de marca), y va
 * embebido como data URI porque Gmail bloquea las imágenes remotas por default:
 * un botón con el ícono roto se ve peor que uno sin ícono.
 */

import { Button, Section, Text } from "@react-email/components";

/** El WhatsApp de SOMOS DER, el mismo que usa la web. */
const WA_NUMERO = "5491171540675";
const VERDE = "#25D366";
const FG_MUTED = "#8A8A8A";

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

const LOGO_WA =
  "data:image/svg+xml;base64," +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="#FFFFFF">' +
      '<path d="M16.004 0C7.17 0 .002 7.168.002 16c0 2.82.74 5.564 2.146 7.98L0 32l8.27-2.114A15.93 15.93 0 0 0 16.004 32C24.838 32 32 24.832 32 16S24.838 0 16.004 0zm0 29.2a13.18 13.18 0 0 1-6.71-1.836l-.48-.286-4.91 1.256 1.31-4.78-.314-.49A13.13 13.13 0 0 1 2.8 16C2.8 8.72 8.724 2.8 16.004 2.8c3.53 0 6.846 1.376 9.34 3.872A13.1 13.1 0 0 1 29.2 16c0 7.28-5.92 13.2-13.196 13.2zm7.24-9.88c-.396-.198-2.346-1.158-2.71-1.29-.364-.132-.63-.198-.894.2-.264.396-1.026 1.29-1.258 1.554-.232.264-.464.298-.86.1-.396-.198-1.674-.617-3.188-1.967-1.178-1.05-1.974-2.348-2.206-2.744-.232-.396-.025-.61.174-.807.18-.178.396-.464.594-.696.198-.232.264-.396.396-.66.132-.264.066-.495-.033-.693-.1-.198-.894-2.152-1.224-2.948-.322-.775-.65-.67-.894-.683l-.76-.013c-.264 0-.693.099-1.056.495-.363.396-1.387 1.355-1.387 3.31s1.42 3.84 1.618 4.105c.198.264 2.794 4.267 6.77 5.984.945.408 1.683.652 2.258.834.948.302 1.812.26 2.494.158.76-.114 2.346-.96 2.676-1.886.33-.926.33-1.72.231-1.886-.098-.165-.362-.264-.758-.462z"/>' +
      "</svg>",
    "utf8"
  ).toString("base64");

export interface PieWhatsAppProps {
  /**
   * Mensaje con el que se abre el chat. Conviene que diga de qué mail viene,
   * así del otro lado se sabe de qué se está hablando sin preguntar.
   */
  mensaje?: string;
}

export function PieWhatsApp({ mensaje }: PieWhatsAppProps) {
  const texto = mensaje?.trim() || "Hola, te escribo por un mail de LABURO.";
  const href = `https://wa.me/${WA_NUMERO}?text=${encodeURIComponent(texto)}`;

  return (
    <Section style={{ marginTop: "26px", textAlign: "center" }}>
      <Button
        href={href}
        style={{
          display: "inline-block",
          backgroundColor: VERDE,
          color: "#FFFFFF",
          fontFamily: FONT_STACK,
          fontSize: "14px",
          fontWeight: 600,
          textDecoration: "none",
          padding: "12px 22px",
          borderRadius: "10px",
        }}
      >
        <img
          src={LOGO_WA}
          width="15"
          height="15"
          alt="WhatsApp"
          style={{ verticalAlign: "-2px", marginRight: "8px", border: 0 }}
        />
        ¿Alguna duda? Escribinos
      </Button>
      <Text
        style={{
          margin: "12px 0 0 0",
          fontFamily: FONT_STACK,
          fontSize: "12px",
          lineHeight: 1.6,
          color: FG_MUTED,
        }}
      >
        SOMOS DER · Staff para eventos
      </Text>
    </Section>
  );
}
