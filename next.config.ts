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
};

export default nextConfig;
