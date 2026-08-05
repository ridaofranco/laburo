/**
 * Mail de bienvenida del PROVEEDOR que se anotó solo (alta abierta, 3/8).
 *
 * ⚠️ LA REGLA QUE YA COSTÓ CARO: el copy tiene que describir exactamente lo que
 * el link abre. El 1/8 el mail del staff decía "no hace falta contraseña" y
 * mandaba a una pantalla que pedía una, y eso costó una trabajadora.
 *
 * Acá la diferencia con el mail de la productora es de fondo y no de forma: el
 * proveedor NO tiene cuenta, NO tiene contraseña y NO va a /login. Entra por un
 * link mágico con token y se acabó. Por eso este mail no habla de contraseñas ni
 * de "tu cuenta": habla del link, de que es suyo y de que vence.
 *
 * Nada de em dash (regla dura de Franco).
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
import { PieWhatsApp } from "./pie-whatsapp";

export interface BienvenidaProveedorProps {
  /** Cómo se llama el proveedor, tal cual lo escribió. */
  nombre: string;
  /** Link mágico a /acceso-proveedor/<token>. */
  link: string;
  /** Cuántos días dura el link, para decirlo sin mentir. */
  dias: number;
  /** true si ya estaba registrado y solo se le mandó un link nuevo. */
  yaExistia?: boolean;
}

const SURFACE_0 = "#000000";
const SURFACE_1 = "#0A0A0A";
const BORDER = "#1A1A1A";
const ACCENT = "#0047FF";
const FG = "#F5F5F5";
const FG_MUTED = "#8A8A8A";
const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

export function BienvenidaProveedor({
  nombre,
  link,
  dias,
  yaExistia = false,
}: BienvenidaProveedorProps) {
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
              {yaExistia ? "Tu link nuevo" : "Ya estás en LABURO"}
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
              {yaExistia
                ? `${nombre}, acá tenés tu link`
                : `${nombre} ya está publicado`}
            </Heading>

            <Text
              style={{ margin: "0 0 14px 0", fontSize: "16px", lineHeight: 1.6, color: FG }}
            >
              {yaExistia
                ? "Tu perfil sigue como lo dejaste, no se tocó nada. Este link reemplaza al anterior, así que usá este de acá en adelante."
                : "Tu perfil ya aparece en el directorio de LABURO y las productoras te pueden encontrar por lo que hacés y por dónde trabajás."}
            </Text>

            <Text
              style={{ margin: "0 0 20px 0", fontSize: "16px", lineHeight: 1.6, color: FG_MUTED }}
            >
              No necesitás cuenta ni contraseña. Con este link entrás a tu panel,
              donde editás tus datos, agregás o sacás servicios, armás el
              formulario con el que te llegan las consultas, y podés sacarte del
              directorio cuando quieras.
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
                Entrar a mi panel
              </Button>
            </Section>

            <Text
              style={{ margin: "18px 0 0 0", fontSize: "14px", lineHeight: 1.5, color: FG_MUTED }}
            >
              Guardá este mail: el link es tuyo y es la forma de volver a entrar.
              Dura {dias} días. Si vence, volvé a anotarte con el mismo mail y te
              mandamos uno nuevo sin perder nada de lo que cargaste.
            </Text>

            <Text
              style={{ margin: "24px 0 0 0", fontSize: "13px", lineHeight: 1.5, color: FG_MUTED }}
            >
              Estar en el directorio es gratis. Cuando una productora te consulta,
              te llega por mail y arreglás directo con ella.
            </Text>
          </Section>
          <PieWhatsApp mensaje="Hola, te escribo por mi perfil de proveedor en LABURO." />
        </Container>
      </Body>
    </Html>
  );
}
