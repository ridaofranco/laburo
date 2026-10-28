import "server-only";

import path from "node:path";
import { type BlogPost, readMarkdownDir } from "./blog";

/**
 * Páginas por público de LABURO (/para/<slug>), 28/10/2026.
 *
 * Son la réplica de las páginas por servicio de somosder-web: una por cada
 * persona que llega desde Google con una necesidad concreta (quien contrata
 * mozos, quien busca trabajo de promotora, quien tiene un salón). Usan el MISMO
 * motor y el mismo frontmatter que el blog (lib/blog.ts), más `audiencia`, que
 * decide el botón principal de la página.
 */
const PARA_DIR = path.join(process.cwd(), "content", "para");

export type Audiencia = "contrata" | "trabaja" | "proveedor" | "salon";

export function getAllPara(): BlogPost[] {
  return readMarkdownDir(PARA_DIR, "para");
}

export function getPara(slug: string): BlogPost | undefined {
  return getAllPara().find((p) => p.slug === slug);
}

/** El botón principal y el secundario según a quién le habla la página. */
export const CTA_POR_AUDIENCIA: Record<
  Audiencia,
  { titulo: string; texto: string; principal: { label: string; href: string }; secundario: { label: string; href: string } }
> = {
  contrata: {
    titulo: "Armá tu equipo.",
    texto:
      "Creá tu cuenta gratis, cargá tu evento y qué roles te faltan, y mandá las ofertas con pago y horario. Si preferís que lo veamos juntos, dejanos tu consulta.",
    principal: { label: "Crear mi cuenta gratis", href: "/registrar-productora" },
    secundario: { label: "Prefiero que me escriban", href: "/#productores" },
  },
  trabaja: {
    titulo: "Cargá tu perfil una vez.",
    texto:
      "Elegí tus roles y tu zona. Cuando haya un evento que encaje, te llega la oferta con pago y fechas, y la aceptás con un click desde el teléfono.",
    principal: { label: "Sumate al pool", href: "/sumate" },
    secundario: { label: "Leer el blog", href: "/blog" },
  },
  proveedor: {
    titulo: "Publicá tu servicio.",
    texto:
      "Contá qué hacés y dónde trabajás. Quien arma un evento te encuentra en el directorio y te pide precio por formulario.",
    principal: { label: "Publicar mis servicios", href: "/registrar-proveedor" },
    secundario: { label: "Ver el directorio", href: "/servicios" },
  },
  salon: {
    titulo: "Publicá tu espacio.",
    texto:
      "Cargá cuánta gente entra y dónde queda. Te encuentran los que están buscando dónde hacer su evento.",
    principal: { label: "Publicar mi salón", href: "/registrar-salon" },
    secundario: { label: "Ver los salones", href: "/salones" },
  },
};

export function ctaDe(audiencia: string | undefined) {
  return CTA_POR_AUDIENCIA[(audiencia as Audiencia) in CTA_POR_AUDIENCIA ? (audiencia as Audiencia) : "contrata"];
}
