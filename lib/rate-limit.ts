import "server-only";
import { headers } from "next/headers";

/**
 * Freno de abuso en memoria (ventana deslizante por identificador).
 * Portado de HITO (`lib/api/rate-limit.ts`), que era el único de los 6 productos
 * que tenía uno, y sin agregar ninguna dependencia.
 *
 * QUÉ PROTEGE ACÁ, Y POR QUÉ IMPORTA AHORA: las pantallas públicas de LABURO
 * mandan mails y consumen cuota de IA. El riesgo real no es que alguien tire el
 * sitio, es que **te queme los envíos del día**: el pedido de acceso manda un mail
 * por Supabase Auth, y ese tope es del proyecto entero, compartido con PASE. Un
 * script pidiendo acceso mil veces deja sin poder entrar a las 699 personas de la
 * tanda de bienvenida. Lo mismo con el autocompletado de CV, que gasta cuota de
 * Gemini.
 *
 * LÍMITE HONESTO: en serverless el contador es por instancia, no global. O sea que
 * frena el abuso desde una IP (que es el caso real) pero no un ataque distribuido.
 * Para eso haría falta Redis, que es plata y complejidad; esto es el piso
 * razonable con cero costo y cero dependencias.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Limpieza perezosa: en una instancia de larga vida el Map no puede crecer sin fin.
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [k, b] of buckets) if (now > b.resetAt) buckets.delete(k);
}

export interface RateResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(identifier: string, limit: number, windowMs = 60_000): RateResult {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(identifier);
  if (!b || now > b.resetAt) {
    buckets.set(identifier, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  b.count += 1;
  return { ok: b.count <= limit, remaining: Math.max(0, limit - b.count), resetAt: b.resetAt };
}

/** IP del cliente a partir de los headers del proxy de Vercel (best-effort). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return h.get("x-real-ip") || "unknown";
}

/** IP de un Request (para route handlers, donde ya tenemos el request a mano). */
export function clientIpFrom(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/**
 * Aplica el freno y devuelve una respuesta 429 lista para retornar, o null si hay
 * que seguir. Para route handlers.
 */
export function rateLimitOr429(identifier: string, limit: number, windowMs = 60_000): Response | null {
  const r = rateLimit(identifier, limit, windowMs);
  if (r.ok) return null;
  return new Response(
    JSON.stringify({ ok: false, error: "Demasiadas solicitudes. Probá de nuevo en un minuto." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil((r.resetAt - Date.now()) / 1000)),
      },
    },
  );
}
