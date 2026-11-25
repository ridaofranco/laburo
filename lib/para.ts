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
    // 16/11: antes mandaba al blog. La bolsa de trabajo (/empleos) es lo que
    // busca quien llegó por «trabajo en eventos», y casi nadie la enlazaba.
    secundario: { label: "Ver búsquedas abiertas", href: "/empleos" },
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

/**
 * ENLACES CON EL TEXTO DE LA BÚSQUEDA (16/11).
 *
 * Search Console, 18/10 al 14/11: Google mostró LABURO 512 veces y todas por
 * notas del blog. Para «personal para eventos», «trabajo en eventos»,
 * «proveedores para eventos» o «salones para eventos», ni una. Las páginas
 * estaban indexadas, pero casi nadie las enlazaba con esas palabras: las notas
 * las nombraban al pie, con el título entero, entre otros 120 enlaces.
 *
 * Cada público tiene una página de entrada, y todo lo que le habla a ese
 * público la enlaza arriba con el texto exacto: las notas (franja «En LABURO»),
 * las páginas /para (migas) y el pie.
 */
export const ENTRADA_POR_AUDIENCIA: Record<Audiencia, { label: string; href: string }> = {
  contrata: { label: "Personal para eventos", href: "/para/personal-para-eventos" },
  trabaja: { label: "Trabajo en eventos", href: "/para/trabajo-en-eventos" },
  proveedor: { label: "Proveedores para eventos", href: "/servicios" },
  salon: { label: "Salones para eventos", href: "/salones" },
};

export function entradaDe(audiencia: string | undefined) {
  return ENTRADA_POR_AUDIENCIA[(audiencia as Audiencia) in ENTRADA_POR_AUDIENCIA ? (audiencia as Audiencia) : "contrata"];
}

/** El texto corto con el que se enlaza una página por público. */
export function anclaDe(p: BlogPost): string {
  return p.ancla ?? p.title.split(":")[0].trim();
}

/**
 * Las páginas que se muestran al pie de una página por público (16/11).
 *
 * Antes eran siempre las primeras cuatro de la lista: cuatro páginas juntaban
 * más de 40 enlaces cada una y «staff para eventos en Buenos Aires» tenía 5.
 * Ahora son las que siguen a la página en el orden de su público, dando la
 * vuelta, así todas reciben la misma cantidad.
 */
export function otrasPara(page: BlogPost, cuantas = 4): BlogPost[] {
  const todas = getAllPara();
  const mias = todas.filter((p) => p.audiencia === page.audiencia);
  const i = mias.findIndex((p) => p.slug === page.slug);
  const enOrden = i < 0 ? mias : [...mias.slice(i + 1), ...mias.slice(0, i)];
  const resto = todas.filter((p) => p.audiencia !== page.audiencia && p.slug !== page.slug);
  return [...enOrden, ...resto].slice(0, cuantas);
}

export function ctaDe(audiencia: string | undefined) {
  return CTA_POR_AUDIENCIA[(audiencia as Audiencia) in CTA_POR_AUDIENCIA ? (audiencia as Audiencia) : "contrata"];
}

/**
 * Qué páginas por público le corresponden a cada nota del blog (28/10). Se
 * muestran al pie de la nota: quien llegó por una guía sigue a la página que
 * lo convierte, y Google ve el camino entre las dos.
 */
export const PARA_POR_NOTA: Record<string, string[]> = {
  "vallado-para-un-evento-que-pedir": ["personal-de-control-de-accesos-y-acreditacion", "staff-para-festivales-y-recitales", "personal-de-montaje-y-armado-para-eventos"],
  "pantallas-led-para-un-evento-que-pedir": ["staff-para-eventos-corporativos", "streaming-y-transmision-de-eventos-publicar"],
  "banos-quimicos-para-un-evento-cuantos-y-que-pedir": ["staff-para-festivales-y-recitales", "seguridad-limpieza-y-servicios-de-operacion-para-eventos-publicar"],
  "grupo-electrogeno-para-un-evento-que-pedir": ["staff-para-festivales-y-recitales", "seguridad-limpieza-y-servicios-de-operacion-para-eventos-publicar"],
  "food-trucks-en-un-evento-como-contratarlos": ["staff-para-festivales-y-recitales", "staff-para-eventos-corporativos", "proveedores-para-eventos-publicar-servicio"],
  "cuanto-cobrar-el-alquiler-de-tu-salon-de-eventos": ["publicar-salon-para-eventos", "espacios-para-eventos-corporativos-publicar"],
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
  "staff-para-stand-en-feria-o-exposicion": ["staff-para-ferias-y-exposiciones", "promotoras-y-azafatas-para-activaciones", "personal-de-montaje-y-armado-para-eventos"],
  "guardarropa-en-un-evento": ["staff-para-eventos-corporativos", "personal-de-control-de-accesos-y-acreditacion"],
  "hostess-y-recepcion-en-eventos-corporativos": ["trabajar-de-promotora-o-azafata", "staff-para-eventos-corporativos"],
  "equipo-de-sampling-o-degustacion": ["promotoras-y-azafatas-para-activaciones", "trabajar-de-promotora-o-azafata"],
  "traductores-e-interpretes-en-un-congreso": ["staff-para-eventos-corporativos", "personal-de-control-de-accesos-y-acreditacion"],
  "que-es-un-stage-manager-en-un-evento": ["trabajar-en-montaje-tecnica-y-produccion-de-eventos", "trabajo-en-eventos-buenos-aires"],
  "como-evaluar-al-staff-despues-del-evento": ["staff-para-eventos-productoras-y-agencias", "planilla-y-whatsapp-o-laburo-para-convocar-staff"],
  "montaje-y-desmontaje-de-eventos-como-cuidarte": ["trabajar-en-montaje-tecnica-y-produccion-de-eventos", "staff-para-eventos-productoras-y-agencias"],
  "trabajar-en-eventos-en-verano-en-la-costa": ["trabajar-en-gastronomia-de-eventos", "trabajo-en-eventos-en-mar-del-plata", "trabajar-de-promotora-o-azafata"],
  "escenario-o-tarima-para-un-evento-que-pedir": ["personal-de-montaje-y-armado-para-eventos", "staff-para-festivales-y-recitales"],
  "trabajar-de-cajero-en-eventos": ["trabajo-en-eventos", "staff-para-festivales-y-recitales"],
  "menores-de-18-en-el-staff-de-un-evento": ["staff-para-eventos-productoras-y-agencias", "trabajar-de-promotora-o-azafata", "personal-de-control-de-accesos-y-acreditacion"],
  "trabajar-en-eventos-en-diciembre-temporada-alta": ["trabajar-en-gastronomia-de-eventos", "trabajar-de-promotora-o-azafata", "trabajo-en-eventos-buenos-aires"],
  "monotributo-para-trabajar-en-eventos": ["trabajo-en-eventos-buenos-aires", "trabajar-de-promotora-o-azafata"],
  "personal-de-limpieza-en-un-evento": ["staff-para-eventos-corporativos", "staff-para-eventos-productoras-y-agencias"],
  "staff-para-un-casamiento": ["staff-para-casamientos-y-fiestas", "mozos-y-bartenders-para-eventos"],
  "staff-para-un-festival-al-aire-libre": ["staff-para-festivales-y-recitales", "personal-de-control-de-accesos-y-acreditacion", "personal-de-montaje-y-armado-para-eventos"],
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
  "alquiler-de-mobiliario-para-eventos-como-conseguir-mas-pedidos": ["proveedores-para-eventos-publicar-servicio", "trabajar-en-montaje-tecnica-y-produccion-de-eventos", "escenografia-ambientacion-y-decoracion-para-eventos-publicar"],
  "catering-para-eventos-como-aparecer-y-que-te-pidan-precio": ["proveedores-para-eventos-publicar-servicio", "mozos-y-bartenders-para-eventos"],
  "staff-para-una-activacion-en-un-shopping": ["promotoras-y-azafatas-para-activaciones", "staff-para-eventos-productoras-y-agencias"],
  "staff-para-un-evento-en-otra-provincia": ["staff-para-eventos-en-el-interior", "staff-para-eventos-en-buenos-aires", "staff-para-eventos-en-misiones"],
  "trabajar-de-recepcionista-o-host-en-eventos": ["personal-de-control-de-accesos-y-acreditacion", "trabajar-de-promotora-o-azafata"],
  "trabajar-de-seguridad-o-control-en-eventos": ["trabajar-en-control-de-accesos-y-acreditacion", "personal-de-control-de-accesos-y-acreditacion"],
  "sonido-e-iluminacion-para-eventos-como-conseguir-clientes": ["proveedores-para-eventos-publicar-servicio", "trabajar-en-montaje-tecnica-y-produccion-de-eventos"],
  "carpas-y-estructuras-para-eventos-que-te-pidan-precio": ["proveedores-para-eventos-publicar-servicio", "trabajar-en-montaje-tecnica-y-produccion-de-eventos", "escenografia-ambientacion-y-decoracion-para-eventos-publicar"],
  "como-describir-tu-salon-para-que-te-encuentren": ["publicar-salon-para-eventos", "estancias-bodegas-y-espacios-no-tradicionales-para-eventos"],
  "reservar-staff-para-diciembre-temporada-alta": ["staff-para-eventos-productoras-y-agencias", "staff-para-eventos-corporativos"],
  "cuando-hace-falta-un-coordinador-de-staff": ["staff-para-eventos-corporativos", "staff-para-eventos-productoras-y-agencias"],
  "staff-para-un-congreso-o-convencion": ["personal-de-control-de-accesos-y-acreditacion", "staff-para-eventos-corporativos"],
  "dress-code-del-staff-de-eventos": ["trabajar-de-promotora-o-azafata", "trabajar-en-gastronomia-de-eventos"],
  "ficha-de-proveedor-de-eventos-que-te-pidan-precio": ["proveedores-para-eventos-publicar-servicio", "trabajar-en-montaje-tecnica-y-produccion-de-eventos"],
  "habilitacion-de-salon-de-eventos-en-caba": ["publicar-salon-para-eventos", "personal-de-control-de-accesos-y-acreditacion"],
  "como-responder-un-pedido-de-presupuesto-de-evento": ["proveedores-para-eventos-publicar-servicio", "publicar-salon-para-eventos"],
  "staff-para-un-evento-de-gaming-o-esports": ["personal-de-control-de-accesos-y-acreditacion", "staff-para-ferias-y-exposiciones"],
  "valet-parking-en-un-evento-que-pedir": ["staff-para-casamientos-y-fiestas", "staff-para-eventos-corporativos"],
  "trabajar-de-animador-en-eventos-infantiles": ["trabajar-de-promotora-o-azafata", "artistas-dj-y-animacion-para-eventos-publicar"],
  "trabajar-en-eventos-los-fines-de-semana-con-otro-trabajo": ["portales-de-empleo-o-laburo-para-trabajar-en-eventos", "trabajar-de-promotora-o-azafata"],
  "plan-b-de-lluvia-para-el-staff-de-un-evento-al-aire-libre": ["staff-para-festivales-y-recitales", "staff-para-eventos-deportivos-y-carreras"],
  "staff-para-un-desfile-o-evento-de-moda": ["personal-de-control-de-accesos-y-acreditacion", "staff-para-eventos-corporativos"],
  "trabajar-de-barista-en-eventos": ["trabajar-en-gastronomia-de-eventos", "mozos-y-bartenders-para-eventos"],
  "trabajar-de-cocinero-o-ayudante-de-cocina-en-eventos": ["trabajar-en-gastronomia-de-eventos", "mozos-y-bartenders-para-eventos"],
  "trabajar-de-tecnico-de-video-led-o-switcher-en-eventos": ["trabajar-en-montaje-tecnica-y-produccion-de-eventos", "streaming-y-transmision-de-eventos-publicar"],
  "trabajar-de-valet-parking-o-chofer-en-eventos": ["portales-de-empleo-o-laburo-para-trabajar-en-eventos", "trabajo-en-eventos-buenos-aires"],
  "trabajar-de-maitre-o-jefe-de-salon-en-eventos": ["trabajar-en-gastronomia-de-eventos", "mozos-y-bartenders-para-eventos"],
  "trabajar-de-sommelier-en-eventos": ["trabajar-en-gastronomia-de-eventos", "mozos-y-bartenders-para-eventos"],
};

/** Las páginas por público de una nota, solo las que existen. */
export function paraDeNota(slugNota: string): BlogPost[] {
  const slugs = PARA_POR_NOTA[slugNota] ?? [];
  return slugs.map(getPara).filter((p): p is BlogPost => Boolean(p));
}

/**
 * Las notas de «Seguir leyendo» (16/11).
 *
 * La lista traía TODAS las demás notas con su bajada: en una nota de 1.000
 * palabras, Google leía otras 4.400 que eran iguales en las 99, y los enlaces a
 * las páginas por público quedaban perdidos entre 120. Ahora son seis: cuatro
 * que comparten página por público (mismo tema) y las dos que siguen en el
 * orden del blog, dando la vuelta. El índice /blog sigue enlazando todas.
 *
 * Sirve igual para las traducciones (en, pt, fr, it): se le pasan las notas de
 * ese idioma y el tema sale de la nota española de la que cada una es
 * traducción (`traduccionDe`), que es la clave de PARA_POR_NOTA.
 */
export function notasRelacionadas(post: BlogPost, todas: BlogPost[], cuantas = 6): BlogPost[] {
  const temaDe = (p: BlogPost) => PARA_POR_NOTA[p.traduccionDe ?? p.slug] ?? [];
  const mias = new Set(temaDe(post));
  const i = todas.findIndex((p) => p.slug === post.slug);
  const enOrden = i < 0 ? todas : [...todas.slice(i + 1), ...todas.slice(0, i)];
  const comunes = (p: BlogPost) => temaDe(p).filter((s) => mias.has(s)).length;
  // Las dos que siguen en el orden van siempre: así ninguna nota se queda sin
  // que otra la enlace, por más que no comparta tema con ninguna.
  const vecinas = enOrden.slice(0, 2);
  const porTema = enOrden
    .slice(2)
    .map((p, pos) => ({ p, pos, c: comunes(p) }))
    .sort((a, b) => b.c - a.c || a.pos - b.pos)
    .slice(0, Math.max(0, cuantas - vecinas.length))
    .map((x) => x.p);
  return [...porTema, ...vecinas];
}
