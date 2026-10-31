/**
 * PIE CON WHATSAPP, compartido por todos los mails de LABURO.
 *
 * Pedido de Franco (26/7): en TODAS las comunicaciones tiene que estar el
 * WhatsApp para poder atender cualquier inquietud. Antes el pie era solo la
 * línea "SOMOS DER · Staff para eventos": si a alguien le quedaba una duda sobre
 * una propuesta de trabajo, no tenía a dónde escribir salvo responder el mail,
 * que nadie hace desde el celular.
 *
 * Logo OFICIAL de WhatsApp, nunca un ícono genérico (regla dura de marca).
 */

import { Button, Section, Text } from "@react-email/components";

/** El WhatsApp de SOMOS DER, el mismo que usa la web. */
const WA_NUMERO = "5491171540675";
const VERDE = "#25D366";
const FG_MUTED = "#8A8A8A";

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

/**
 * PNG en vez de data URI SVG (31/10): Gmail descarta los `data:` en <img> y
 * Outlook no muestra SVG, así que el botón salía con el ícono roto. Es el mismo
 * logo oficial, blanco, a 60 px (se muestra a 15: nítido en pantallas retina).
 */
const LOGO_WA = "https://laburo.somosder.ar/brand/whatsapp-mail.png";

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
