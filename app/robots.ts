import type { MetadataRoute } from "next";
import { BLOG_ORIGIN } from "@/lib/blog";

/**
 * robots.txt.
 *
 * Se bloquean las rutas privadas o de un solo uso: la app gateada no aporta
 * nada a un índice (todo redirige a /login) y los links mágicos por token
 * (/o/<token>, /baja, /definir-contrasena) son de una persona y de un momento —
 * no tienen que quedar guardados en ningún lado.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/o/",
        "/baja",
        "/definir-contrasena",
        "/login",
        "/acceso-staff",
        "/dev-login",
        "/dev-login-staff",
        "/panel-staff",
        "/fichaje",
        "/onboarding-staff",
        "/editar-perfil-staff",
      ],
    },
    sitemap: `${BLOG_ORIGIN}/sitemap.xml`,
  };
}
