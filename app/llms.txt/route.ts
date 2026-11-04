import { BLOG_ORIGIN, getAllPosts } from "@/lib/blog";
import { getAllPara } from "@/lib/para";

/**
 * llms.txt de LABURO (28/10/2026): lo que leen los asistentes de IA para
 * entender qué es el sitio. Mismo criterio que el de somosder-web: solo hechos
 * que la web ya dice, y la lista de páginas que vale la pena citar.
 * Se arma al compilar (force-static), así que lee content/ sin tocar la base.
 */
export const dynamic = "force-static";

export function GET() {
  const para = getAllPara();
  const posts = getAllPosts();

  const texto = `# LABURO

> LABURO es un portal gratuito de ofertas de trabajo y perfiles para eventos en Argentina: staff eventual, proveedores de todos los rubros y salones por capacidad. Lo hace SOMOS DER (productora de eventos de Buenos Aires). Crear la cuenta y usarlo es gratis. Ni LABURO ni SOMOS DER contratan, emplean ni son intermediarios: quien publica una oferta elige, contrata y paga directo, y LABURO no cobra entre partes.

LABURO nace adentro de SOMOS DER (https://www.somosder.ar) y es el mismo sistema con el que la productora arma sus propias operaciones. Respaldo de SOMOS DER: más de 100 eventos operados, más de 150.000 asistentes, 6 países.

## Cómo funciona
- Quien arma un evento (productora, agencia, marca, empresa) crea su cuenta gratis, carga fecha, lugar y qué le falta, y declara la dotación por rol.
- Busca gente por rol y zona entre los perfiles cargados y elige directo: LABURO no elige ni recomienda a nadie. Cada persona recibe la oferta con pago y horarios y la acepta con un click desde el teléfono, sin crear contraseña. El tablero muestra cuántos lugares están cubiertos y cuántos faltan.
- A proveedores se les pide precio con un pedido que les llega por mail: cargan su presupuesto en ese link y se comparan todos en una tabla, separando pesos y dólares. A los salones se les consulta la fecha desde su ficha y contestan por mail.
- Quien trabaja en eventos carga su perfil una vez (roles y zona) y recibe ofertas con pago y fechas.
- Proveedores (sonido, catering, seguridad, estructuras y más) y salones publican gratis lo que hacen, dónde trabajan y cuánta gente entra.
- Quien busca trabajo nunca paga: LABURO no cobra por postularse ni por conseguir trabajo. Si una oferta pide plata o discrimina, se denuncia.

## Páginas principales
- [Inicio](${BLOG_ORIGIN}/): qué es LABURO y los cuatro caminos (contratar, trabajar, publicar un servicio, publicar un salón).
- [Sumate al pool](${BLOG_ORIGIN}/sumate): alta de quien trabaja en eventos.
- [Proveedores para eventos](${BLOG_ORIGIN}/servicios): directorio público de proveedores.
- [Salones para eventos](${BLOG_ORIGIN}/salones): directorio público de salones por capacidad y zona.
- [Para quién es](${BLOG_ORIGIN}/para): páginas por público.
- [Crear cuenta](${BLOG_ORIGIN}/registrarme): elegir el camino (buscar staff, trabajar, publicar un servicio o un salón).
- [Cuenta de productora](${BLOG_ORIGIN}/registrar-productora): alta gratis para cargar eventos y contratar staff.
- [Publicar un servicio](${BLOG_ORIGIN}/registrar-proveedor): alta gratis de proveedores en el directorio.
- [Publicar un salón](${BLOG_ORIGIN}/registrar-salon): alta gratis de salones en el directorio.
- [Licitaciones abiertas](${BLOG_ORIGIN}/licitaciones): pedidos de presupuesto abiertos; cualquier proveedor cotiza sin cuenta.

## Páginas por público
${para.map((p) => `- [${p.title}](${p.canonical}): ${p.description}`).join("\n")}

## Blog (guías desde la operación real de SOMOS DER)
${posts.map((p) => `- [${p.title}](${p.canonical}): ${p.description}`).join("\n")}

## Ecosistema SOMOS DER
- SOMOS DER (https://www.somosder.ar): productora de eventos y experiencias de marca, Buenos Aires.
- PASE (https://pase.somosder.ar): acreditación y control de accesos con QR.
- ENTRÁ (https://www.entratickets.com): venta de entradas.
`;

  return new Response(texto, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
