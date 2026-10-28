import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El repo vive dentro de "Proyectos/SOMOS DER" que tiene otro package-lock:
  // fijar la raíz evita que Next infiera mal el workspace.
  outputFileTracingRoot: path.join(__dirname),
  // `next dev` y `next build` escriben los dos en `.next`, así que un build de
  // verificación pisa el server de desarrollo que esté corriendo. Con
  // NEXT_DIST_DIR se manda ese build a otra carpeta y el dev sigue vivo.
  // Sin la variable no cambia nada: en Vercel y en local sigue siendo `.next`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  /**
   * EL SITEMAP SIN EL BLOG (28/10).
   *
   * `app/sitemap.ts` consulta la base (proveedores y salones), así que corre
   * en el servidor en cada pedido y no al compilar. Y lee los artículos con
   * `fs` desde `content/blog`, una carpeta que Vercel NO mete en la función
   * porque ningún import la nombra. Resultado: en producción `getAllPosts()`
   * daba [] y el sitemap salía con 5 direcciones y ninguno de los 12 artículos.
   * El blog en sí andaba porque sus páginas se arman al compilar.
   */
  outputFileTracingIncludes: {
    "/sitemap.xml": ["./content/blog/**/*"],
  },
  experimental: {
    /**
     * EL LÍMITE QUE ROMPÍA EL REGISTRO CON CV (6/8).
     *
     * `/sumate` manda el CV adjunto adentro de un Server Action
     * (`registerApplicant`), y Next topea los Server Actions en **1 MB** por
     * default. Nadie lo había subido nunca. Resultado: cualquier CV con una
     * foto (o sea casi todos) reventaba el envío, y como el error se traga en
     * un `catch` genérico, la persona leía "No se pudo enviar. Probá de nuevo"
     * y no había forma de que entendiera que el problema era el tamaño.
     *
     * 4 MB y no más: el techo REAL no es este número, es el de Vercel, que
     * rechaza el body de una función serverless por encima de 4,5 MB con
     * FUNCTION_PAYLOAD_TOO_LARGE (verificado contra producción). Poner acá 10
     * MB no serviría de nada: seguiría cortando la infraestructura, y encima
     * más tarde y sin un error propio.
     */
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
