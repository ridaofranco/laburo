/**
 * Datos estructurados (schema.org) de las fichas públicas de la vidriera:
 * /servicios/[slug] (proveedor) y /salones/[slug] (salón).
 *
 * Las fichas son toda la presencia en buscadores que tiene un proveedor chico,
 * y no llevaban ningún JSON-LD (29/10). Solo se declara lo que el proveedor o
 * el salón cargó: nada de reseñas, horarios ni teléfonos inventados.
 *
 * ⚠️ El texto lo escribe cada proveedor y va adentro de un <script>: por eso
 * `jsonLdSeguro` escapa «<», así un «</script>» en la bio no corta la etiqueta.
 */

import { BLOG_ORIGIN } from "@/lib/blog";
import type { FichaProveedor } from "@/app/servicios/actions";
import type { FichaSalon } from "@/app/salones/actions";
import { textoCapacidad, urlDeFotoSalon } from "@/lib/salones";

export function jsonLdSeguro(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function urlInstagram(ig: string | null): string | null {
  const v = ig?.trim();
  if (!v) return null;
  return v.startsWith("http") ? v : `https://instagram.com/${v.replace(/^@/, "")}`;
}

function urlWeb(web: string | null): string | null {
  const v = web?.trim();
  if (!v) return null;
  return v.startsWith("http") ? v : `https://${v}`;
}

function direccion(ciudad: string | null, provincia: string | null, calle?: string | null) {
  const c = ciudad?.trim().replace(/,+$/, "");
  const p = provincia?.trim();
  if (!c && !p && !calle?.trim()) return undefined;
  return {
    "@type": "PostalAddress",
    ...(calle?.trim() ? { streetAddress: calle.trim() } : {}),
    ...(c ? { addressLocality: c } : {}),
    ...(p ? { addressRegion: p } : {}),
    addressCountry: "AR",
  };
}

function migas(seccion: { nombre: string; path: string }, nombre: string, path: string) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "LABURO", item: BLOG_ORIGIN },
      { "@type": "ListItem", position: 2, name: seccion.nombre, item: `${BLOG_ORIGIN}${seccion.path}` },
      { "@type": "ListItem", position: 3, name: nombre, item: `${BLOG_ORIGIN}${path}` },
    ],
  };
}

export function schemaProveedor(p: FichaProveedor) {
  const url = `${BLOG_ORIGIN}/servicios/${p.slug}`;
  const nombre = p.display_name?.trim() || "Proveedor";
  const sameAs = [urlWeb(p.website), urlInstagram(p.instagram)].filter(Boolean);
  const provincias = Array.from(new Set((p.servicios ?? []).flatMap((s) => s.provincias ?? [])));

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        "@id": `${url}#proveedor`,
        name: nombre,
        url,
        ...(p.headline?.trim() || p.bio?.trim()
          ? { description: (p.headline?.trim() || p.bio?.trim() || "").slice(0, 300) }
          : {}),
        ...(direccion(p.ciudad, p.provincia) ? { address: direccion(p.ciudad, p.provincia) } : {}),
        ...(provincias.length
          ? { areaServed: provincias.map((name) => ({ "@type": "AdministrativeArea", name })) }
          : {}),
        ...(sameAs.length ? { sameAs } : {}),
        ...(p.servicios.length
          ? {
              makesOffer: p.servicios.map((s) => ({
                "@type": "Offer",
                itemOffered: {
                  "@type": "Service",
                  name: s.titulo,
                  serviceType: s.categoria,
                  ...(s.descripcion?.trim() ? { description: s.descripcion.trim().slice(0, 300) } : {}),
                },
                ...(s.precio_desde != null
                  ? {
                      priceSpecification: {
                        "@type": "PriceSpecification",
                        minPrice: s.precio_desde,
                        priceCurrency: s.moneda || "ARS",
                      },
                    }
                  : {}),
              })),
            }
          : {}),
      },
      migas({ nombre: "Proveedores", path: "/servicios" }, nombre, `/servicios/${p.slug}`),
    ],
  };
}

export function schemaSalon(s: FichaSalon) {
  const url = `${BLOG_ORIGIN}/salones/${s.slug}`;
  const nombre = s.display_name?.trim() || "Salón";
  const sameAs = [urlWeb(s.website), urlInstagram(s.instagram)].filter(Boolean);
  const capacidad = s.capacidad_max ?? s.capacidad_min;
  const amenities = [
    ...(s.amenities ?? []),
    ...(s.catering_propio ? ["Catering propio"] : []),
    ...(s.estacionamiento ? ["Estacionamiento"] : []),
  ];

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "EventVenue",
        "@id": `${url}#salon`,
        name: nombre,
        url,
        ...(s.headline?.trim() || s.bio?.trim()
          ? { description: (s.headline?.trim() || s.bio?.trim() || "").slice(0, 300) }
          : {}),
        ...(direccion(s.ciudad, s.provincia, s.direccion)
          ? { address: direccion(s.ciudad, s.provincia, s.direccion) }
          : {}),
        ...(capacidad ? { maximumAttendeeCapacity: capacidad } : {}),
        ...(s.fotos?.length ? { image: s.fotos.slice(0, 4).map(urlDeFotoSalon) } : {}),
        ...(amenities.length
          ? {
              amenityFeature: amenities.map((name) => ({
                "@type": "LocationFeatureSpecification",
                name,
                value: true,
              })),
            }
          : {}),
        ...(sameAs.length ? { sameAs } : {}),
        ...(textoCapacidad(s.capacidad_min, s.capacidad_max)
          ? { additionalProperty: { "@type": "PropertyValue", name: "Capacidad", value: textoCapacidad(s.capacidad_min, s.capacidad_max) } }
          : {}),
      },
      migas({ nombre: "Salones", path: "/salones" }, nombre, `/salones/${s.slug}`),
    ],
  };
}

/** El listado de una vidriera (/servicios o /salones) como CollectionPage +
 *  ItemList. Solo sin filtros: una búsqueda filtrada no es «la» lista. */
export function schemaListado(
  titulo: string,
  path: string,
  items: { slug: string; display_name: string | null }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: titulo,
    url: `${BLOG_ORIGIN}${path}`,
    inLanguage: "es-AR",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.map((it, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: it.display_name?.trim() || it.slug,
        url: `${BLOG_ORIGIN}${path}/${it.slug}`,
      })),
    },
  };
}
