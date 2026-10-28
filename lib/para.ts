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

/**
 * Qué páginas por público le corresponden a cada nota del blog (28/10). Se
 * muestran al pie de la nota: quien llegó por una guía sigue a la página que
 * lo convierte, y Google ve el camino entre las dos.
 */
export const PARA_POR_NOTA: Record<string, string[]> = {
  "carnet-de-manipulador-de-alimentos-para-eventos": ["trabajar-en-gastronomia-de-eventos", "mozos-y-bartenders-para-eventos"],
  "como-armar-staff-evento-roles": ["staff-para-eventos-productoras-y-agencias", "staff-para-eventos-corporativos"],
  "como-elegir-salon-para-un-evento-por-capacidad": ["publicar-salon-para-eventos", "staff-para-eventos-corporativos"],
  "como-es-trabajar-en-eventos-y-como-se-cobra": ["trabajo-en-eventos-buenos-aires", "trabajar-de-promotora-o-azafata"],
  "como-lograr-que-te-llamen-seguido-para-eventos": ["trabajo-en-eventos-buenos-aires", "trabajar-en-montaje-tecnica-y-produccion-de-eventos"],
  "como-pedir-presupuesto-a-proveedores-de-eventos": ["proveedores-para-eventos-publicar-servicio", "staff-para-eventos-productoras-y-agencias"],
  "cuanta-gente-necesito-para-mi-evento": ["staff-para-eventos-productoras-y-agencias", "personal-de-control-de-accesos-y-acreditacion"],
  "cuanto-sale-contratar-staff-para-un-evento": ["staff-para-eventos-corporativos", "mozos-y-bartenders-para-eventos"],
  "documentacion-para-contratar-personal-eventual": ["staff-para-eventos-productoras-y-agencias", "staff-para-eventos-corporativos"],
  "oficios-de-eventos-con-mas-salida": ["trabajo-en-eventos-buenos-aires", "trabajar-en-gastronomia-de-eventos"],
  "primer-dia-trabajando-en-un-evento": ["trabajo-en-eventos-buenos-aires", "trabajar-de-promotora-o-azafata"],
  "que-mirar-antes-de-contratar-personal-evento": ["staff-para-eventos-productoras-y-agencias", "promotoras-y-azafatas-para-activaciones"],
  "que-poner-en-tu-perfil-para-trabajar-en-eventos": ["trabajo-en-eventos-buenos-aires", "trabajar-en-montaje-tecnica-y-produccion-de-eventos"],
  "si-te-falla-un-staff-el-dia-del-evento": ["staff-para-eventos-productoras-y-agencias", "personal-de-control-de-accesos-y-acreditacion"],
  "trabajar-en-eventos-sin-experiencia": ["trabajo-en-eventos-buenos-aires", "trabajar-de-promotora-o-azafata"],
  "que-hace-un-acreditador-en-un-congreso": ["personal-de-control-de-accesos-y-acreditacion", "staff-para-eventos-corporativos"],
  "turnos-y-horarios-del-staff-en-un-evento-largo": ["staff-para-eventos-productoras-y-agencias", "mozos-y-bartenders-para-eventos"],
  "como-contratar-bartenders-para-evento-corporativo": ["mozos-y-bartenders-para-eventos", "staff-para-eventos-corporativos"],
  "ley-26370-admision-y-permanencia-personal-de-puerta": ["personal-de-control-de-accesos-y-acreditacion", "staff-para-eventos-productoras-y-agencias"],
  "como-armar-el-brief-para-promotoras-de-una-activacion": ["promotoras-y-azafatas-para-activaciones", "trabajar-de-promotora-o-azafata"],
  "que-es-un-stage-manager-en-un-evento": ["trabajar-en-montaje-tecnica-y-produccion-de-eventos", "trabajo-en-eventos-buenos-aires"],
};

/** Las páginas por público de una nota, solo las que existen. */
export function paraDeNota(slugNota: string): BlogPost[] {
  const slugs = PARA_POR_NOTA[slugNota] ?? [];
  return slugs.map(getPara).filter((p): p is BlogPost => Boolean(p));
}
