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

> LABURO es la plataforma de SOMOS DER (productora de eventos de Buenos Aires, Argentina) para armar un evento entero en un solo lugar: staff eventual con perfil y CV a la vista, proveedores de todos los rubros y salones por capacidad. Crear la cuenta y usarlo es gratis.

LABURO nace adentro de SOMOS DER (https://www.somosder.ar) y es el mismo sistema con el que la productora arma sus propias operaciones. Respaldo de SOMOS DER: más de 100 eventos operados, más de 150.000 asistentes, 6 países. Más de 1.100 postulantes con perfil en el pool.

## Cómo funciona
- Quien arma un evento (productora, agencia, marca, empresa) crea su cuenta gratis, carga fecha, lugar y qué le falta, y declara la dotación por rol.
- Busca staff por rol, zona y experiencia, con perfil y CV a la vista, y manda la oferta con pago y horarios. La persona la acepta con un click desde el teléfono, sin crear contraseña. El tablero muestra cuántos lugares están cubiertos y cuántos faltan.
- A proveedores se les pide precio con un pedido que les llega por mail: cargan su presupuesto en ese link y se comparan todos en una tabla, separando pesos y dólares. A los salones se les consulta la fecha desde su ficha y contestan por mail.
- Quien trabaja en eventos carga su perfil una vez (roles y zona) y recibe ofertas con pago y fechas.
- Proveedores (sonido, catering, seguridad, estructuras y más) y salones publican gratis lo que hacen, dónde trabajan y cuánta gente entra.
- Si se prefiere que lo vea SOMOS DER, se deja una consulta en la home o se escribe por WhatsApp al +54 9 11 7154-0675.

## Páginas principales
- [Inicio](${BLOG_ORIGIN}/): qué es LABURO y los cuatro caminos (contratar, trabajar, publicar un servicio, publicar un salón).
- [Sumate al pool](${BLOG_ORIGIN}/sumate): alta de quien trabaja en eventos.
- [Proveedores para eventos](${BLOG_ORIGIN}/servicios): directorio público de proveedores.
- [Salones para eventos](${BLOG_ORIGIN}/salones): directorio público de salones por capacidad y zona.
- [Para quién es](${BLOG_ORIGIN}/para): páginas por público.

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
