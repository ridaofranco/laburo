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
      "Creá tu cuenta gratis, cargá tu evento y qué roles te faltan, y el equipo de LABURO te arma el staff con gente de su pool. Si preferís que lo veamos juntos, dejanos tu consulta.",
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
  "que-hace-un-acreditador-en-un-congreso": ["trabajar-en-control-de-accesos-y-acreditacion", "personal-de-control-de-accesos-y-acreditacion"],
  "turnos-y-horarios-del-staff-en-un-evento-largo": ["staff-para-eventos-productoras-y-agencias", "mozos-y-bartenders-para-eventos"],
  "como-contratar-bartenders-para-evento-corporativo": ["mozos-y-bartenders-para-eventos", "staff-para-eventos-corporativos"],
  "ley-26370-admision-y-permanencia-personal-de-puerta": ["personal-de-control-de-accesos-y-acreditacion", "staff-para-eventos-productoras-y-agencias", "staff-para-boliches-y-fiestas-nocturnas"],
  "como-armar-el-brief-para-promotoras-de-una-activacion": ["promotoras-y-azafatas-para-activaciones", "trabajar-de-promotora-o-azafata"],
  "fiesta-de-fin-de-ano-de-empresa-como-armar-el-staff": ["staff-para-eventos-corporativos", "mozos-y-bartenders-para-eventos"],
  "app-para-trabajar-en-eventos-que-mirar": ["trabajo-en-eventos-buenos-aires", "trabajar-de-promotora-o-azafata"],
  "de-staff-a-coordinador-de-equipo-en-eventos": ["trabajo-en-eventos-buenos-aires", "trabajar-en-montaje-tecnica-y-produccion-de-eventos"],
  "seguridad-privada-en-eventos-caba": ["personal-de-control-de-accesos-y-acreditacion", "seguridad-limpieza-y-servicios-de-operacion-para-eventos-publicar"],
  "que-hace-un-runner-en-un-evento": ["trabajar-en-montaje-tecnica-y-produccion-de-eventos", "trabajo-en-eventos-buenos-aires"],
  "staff-para-stand-en-feria-o-exposicion": ["staff-para-ferias-y-exposiciones", "promotoras-y-azafatas-para-activaciones"],
  "guardarropa-en-un-evento": ["staff-para-eventos-corporativos", "personal-de-control-de-accesos-y-acreditacion"],
  "hostess-y-recepcion-en-eventos-corporativos": ["trabajar-de-promotora-o-azafata", "staff-para-eventos-corporativos"],
  "equipo-de-sampling-o-degustacion": ["promotoras-y-azafatas-para-activaciones", "trabajar-de-promotora-o-azafata"],
  "traductores-e-interpretes-en-un-congreso": ["staff-para-eventos-corporativos", "personal-de-control-de-accesos-y-acreditacion"],
  "que-es-un-stage-manager-en-un-evento": ["trabajar-en-montaje-tecnica-y-produccion-de-eventos", "trabajo-en-eventos-buenos-aires"],
  "como-evaluar-al-staff-despues-del-evento": ["staff-para-eventos-productoras-y-agencias", "planilla-y-whatsapp-o-laburo-para-convocar-staff"],
  "montaje-y-desmontaje-de-eventos-como-cuidarte": ["trabajar-en-montaje-tecnica-y-produccion-de-eventos", "staff-para-eventos-productoras-y-agencias"],
  "trabajar-en-eventos-en-verano-en-la-costa": ["trabajar-en-gastronomia-de-eventos", "trabajar-de-promotora-o-azafata"],
  "monotributo-para-trabajar-en-eventos": ["trabajo-en-eventos-buenos-aires", "trabajar-de-promotora-o-azafata"],
  "personal-de-limpieza-en-un-evento": ["staff-para-eventos-corporativos", "staff-para-eventos-productoras-y-agencias"],
  "staff-para-un-casamiento": ["staff-para-casamientos-y-fiestas", "mozos-y-bartenders-para-eventos"],
  "staff-para-un-festival-al-aire-libre": ["staff-para-festivales-y-recitales", "personal-de-control-de-accesos-y-acreditacion"],
  "trabajar-de-bartender-en-eventos": ["trabajar-en-gastronomia-de-eventos", "mozos-y-bartenders-para-eventos", "staff-para-boliches-y-fiestas-nocturnas"],
  "staff-para-un-evento-deportivo": ["staff-para-eventos-deportivos-y-carreras", "personal-de-control-de-accesos-y-acreditacion"],
  "trabajar-de-mozo-en-eventos": ["trabajar-en-gastronomia-de-eventos", "mozos-y-bartenders-para-eventos"],
  "staff-para-una-fiesta-de-15": ["staff-para-casamientos-y-fiestas", "mozos-y-bartenders-para-eventos"],
  "staff-para-un-lanzamiento-de-producto": ["promotoras-y-azafatas-para-activaciones", "staff-para-eventos-corporativos"],
  "staff-para-un-recital-o-show-en-vivo": ["staff-para-festivales-y-recitales", "personal-de-control-de-accesos-y-acreditacion", "staff-para-boliches-y-fiestas-nocturnas"],
  "volver-a-casa-despues-de-un-evento-de-madrugada": ["trabajo-en-eventos-buenos-aires", "staff-para-eventos-en-buenos-aires", "staff-para-boliches-y-fiestas-nocturnas"],
  "trabajar-en-eventos-siendo-estudiante": ["trabajo-en-eventos-buenos-aires", "trabajar-en-gastronomia-de-eventos"],
  "como-presentarte-a-un-casting-de-promotoras": ["trabajar-de-promotora-o-azafata", "trabajo-en-eventos-buenos-aires"],
  "como-contestar-una-consulta-de-salon": ["publicar-salon-para-eventos", "espacios-para-eventos-corporativos-publicar"],
  "salon-de-eventos-temporada-de-fin-de-ano": ["publicar-salon-para-eventos", "espacios-para-eventos-corporativos-publicar"],
  "trabajar-en-eventos-despues-de-los-40": ["trabajo-en-eventos-buenos-aires", "personal-de-control-de-accesos-y-acreditacion"],
  "como-organizar-los-pagos-del-staff-de-un-evento": ["planilla-y-whatsapp-o-laburo-para-convocar-staff", "staff-para-eventos-productoras-y-agencias"],
  "staff-para-un-evento-en-un-hotel": ["staff-para-eventos-corporativos", "personal-de-control-de-accesos-y-acreditacion"],
  "proveedores-de-eventos-como-prepararte-para-fin-de-ano": ["proveedores-para-eventos-publicar-servicio", "trabajar-en-montaje-tecnica-y-produccion-de-eventos"],
  "staff-para-una-feria-gastronomica": ["staff-para-ferias-y-exposiciones", "mozos-y-bartenders-para-eventos"],
  "staff-para-un-evento-de-verano-en-la-costa": ["staff-para-eventos-productoras-y-agencias", "promotoras-y-azafatas-para-activaciones"],
  "quinta-o-salon-con-pileta-para-eventos-en-verano": ["publicar-salon-para-eventos", "mozos-y-bartenders-para-eventos"],
  "como-preparar-la-visita-a-tu-salon": ["publicar-salon-para-eventos", "mozos-y-bartenders-para-eventos"],
  "que-llevar-a-un-evento-si-trabajas-de-staff": ["trabajar-de-promotora-o-azafata", "trabajar-en-gastronomia-de-eventos"],
  "como-bajarte-de-un-evento-que-ya-aceptaste": ["trabajo-en-eventos-buenos-aires", "portales-de-empleo-o-laburo-para-trabajar-en-eventos"],
  "staff-para-un-evento-infantil": ["personal-de-control-de-accesos-y-acreditacion", "mozos-y-bartenders-para-eventos"],
  "staff-para-la-inauguracion-de-un-local": ["promotoras-y-azafatas-para-activaciones", "personal-de-control-de-accesos-y-acreditacion"],
  "trabajar-de-tecnico-de-sonido-o-luces-en-eventos": ["trabajar-en-montaje-tecnica-y-produccion-de-eventos", "staff-para-eventos-corporativos"],
  "trabajar-de-fotografo-o-filmmaker-en-eventos": ["proveedores-para-eventos-publicar-servicio", "staff-para-eventos-corporativos"],
  "alquiler-de-mobiliario-para-eventos-como-conseguir-mas-pedidos": ["proveedores-para-eventos-publicar-servicio", "trabajar-en-montaje-tecnica-y-produccion-de-eventos"],
  "catering-para-eventos-como-aparecer-y-que-te-pidan-precio": ["proveedores-para-eventos-publicar-servicio", "mozos-y-bartenders-para-eventos"],
  "staff-para-una-activacion-en-un-shopping": ["promotoras-y-azafatas-para-activaciones", "staff-para-eventos-productoras-y-agencias"],
  "staff-para-un-evento-en-otra-provincia": ["staff-para-eventos-en-buenos-aires", "staff-para-eventos-en-misiones"],
  "trabajar-de-recepcionista-o-host-en-eventos": ["personal-de-control-de-accesos-y-acreditacion", "trabajar-de-promotora-o-azafata"],
  "trabajar-de-seguridad-o-control-en-eventos": ["trabajar-en-control-de-accesos-y-acreditacion", "personal-de-control-de-accesos-y-acreditacion"],
  "sonido-e-iluminacion-para-eventos-como-conseguir-clientes": ["proveedores-para-eventos-publicar-servicio", "trabajar-en-montaje-tecnica-y-produccion-de-eventos"],
  "carpas-y-estructuras-para-eventos-que-te-pidan-precio": ["proveedores-para-eventos-publicar-servicio", "trabajar-en-montaje-tecnica-y-produccion-de-eventos"],
  "como-describir-tu-salon-para-que-te-encuentren": ["publicar-salon-para-eventos", "estancias-bodegas-y-espacios-no-tradicionales-para-eventos"],
  "reservar-staff-para-diciembre-temporada-alta": ["staff-para-eventos-productoras-y-agencias", "staff-para-eventos-corporativos"],
  "cuando-hace-falta-un-coordinador-de-staff": ["staff-para-eventos-corporativos", "staff-para-eventos-productoras-y-agencias"],
  "staff-para-un-congreso-o-convencion": ["personal-de-control-de-accesos-y-acreditacion", "staff-para-eventos-corporativos"],
  "dress-code-del-staff-de-eventos": ["trabajar-de-promotora-o-azafata", "trabajar-en-gastronomia-de-eventos"],
  "ficha-de-proveedor-de-eventos-que-te-pidan-precio": ["proveedores-para-eventos-publicar-servicio", "trabajar-en-montaje-tecnica-y-produccion-de-eventos"],
  "habilitacion-de-salon-de-eventos-en-caba": ["publicar-salon-para-eventos", "personal-de-control-de-accesos-y-acreditacion"],
  "como-responder-un-pedido-de-presupuesto-de-evento": ["proveedores-para-eventos-publicar-servicio", "publicar-salon-para-eventos"],
};

/** Las páginas por público de una nota, solo las que existen. */
export function paraDeNota(slugNota: string): BlogPost[] {
  const slugs = PARA_POR_NOTA[slugNota] ?? [];
  return slugs.map(getPara).filter((p): p is BlogPost => Boolean(p));
}
