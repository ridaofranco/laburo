/**
 * ENCABEZADO DE MARCA DE LOS MAILS DE LABURO.
 *
 * ── POR QUÉ EXISTE (pedido de Franco, 26/7) ──
 * Los mails de LABURO no tenían el logo en ningún lado. Y no era un olvido: hasta
 * hoy **LABURO no tenía ni un archivo de imagen en todo el repo** (ni logo, ni
 * favicon, ni og). Su wordmark existía solo como texto con la fuente Syne, que en
 * un mail no sirve: los clientes de correo no cargan fuentes, así que "LABURO."
 * salía en la tipografía por defecto y no se veía como la marca.
 *
 * Así que el wordmark se renderizó a PNG con su fuente real (Syne 800, all-caps,
 * tracking -0.02em, off-white) y quedó en `public/brand/laburo-wordmark.png`. Es
 * el mismo wordmark de la app, no un logo inventado.
 *
 * ── POR QUÉ URL REMOTA Y NO data URI ──
 * DER usa una URL remota para su logo en los mails y funciona. Gmail **proxea**
 * las imágenes remotas (las sirve por googleusercontent), en cambio los data URI
 * en `<img>` los descarta el cliente web de Gmail. Así que para un logo, remoto es
 * lo confiable. (Ojo: los mails de esta app usan un data URI para el ícono de
 * WhatsApp, y **eso conviene verificarlo en una casilla real de Gmail**: si no se
 * ve, hay que pasarlo a remoto también.)
 *
 * ⚠️ La imagen se sirve desde `laburo.somosder.ar`, así que **hasta que se deploye
 * no existe** y en las previews locales va a aparecer cortada. No es un bug.
 *
 * Si algún día LABURO tiene un logo de verdad (símbolo, no solo wordmark), se
 * reemplaza el archivo y no hay que tocar ningún mail.
 */

import { Img, Section, Text } from "@react-email/components";

const FG_MUTED = "#8A8A8A";
const BASE = "https://laburo.somosder.ar";

export function Encabezado({ bajada = "Staff para eventos · SOMOS DER" }: { bajada?: string }) {
  return (
    <Section style={{ padding: "0 0 20px 0" }}>
      <Img
        src={`${BASE}/brand/laburo-wordmark.png`}
        alt="LABURO"
        width="118"
        height="21"
        style={{ display: "block", border: 0, outline: "none" }}
      />
      <Text
        style={{
          margin: "8px 0 0 0",
          fontSize: "10px",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: FG_MUTED,
        }}
      >
        {bajada}
      </Text>
    </Section>
  );
}
