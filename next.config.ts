import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El repo vive dentro de "Proyectos/SOMOS DER" que tiene otro package-lock:
  // fijar la raíz evita que Next infiera mal el workspace.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
