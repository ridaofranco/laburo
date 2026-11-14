/**
 * ⚠️ TEMPORAL (14/11): manda los tres mails nuevos (proveedor, salón, persona)
 * por el camino real (Resend, remitente real) SOLO a los perfiles de prueba de
 * la base (fuente = 'prueba', con el mail de Franco). Se borra después de la
 * prueba. Gate: clave de un solo uso cuyo sha256 está acá; sin ella, 404.
 */

import { createHash } from "crypto";
import { createElement } from "react";
import { render } from "@react-email/components";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { sendMail } from "@/lib/email/mailer";
import { RedInvitacionEmail, asuntoRedInvitacion, idiomaDePais } from "@/components/emails/red-invitacion-email";
import { WelcomeLegacyEmail } from "@/components/emails/welcome-legacy-email";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
const CLAVE_SHA256 = "599d9b3acd71b16cd63d5d465d2dd3b8e84c1d6c3c50f1e2a799d37c0efa62ac";
const TOKEN = /^[a-f0-9]{64}$/;

interface Dest { email: string; tipo: string; nombre: string; pais: string | null; baja_token: string }

export async function GET(request: Request) {
  const u = new URL(request.url);
  const k = u.searchParams.get("k") ?? "";
  if (createHash("sha256").update(k).digest("hex") !== CLAVE_SHA256) return new Response("Not found", { status: 404 });
  const tokens: Record<string, string> = { proveedor: u.searchParams.get("p") ?? "", salon: u.searchParams.get("s") ?? "" };
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("staff_app_prueba_destinatarios");
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  const res: unknown[] = [];
  let personaA: string | null = null;
  for (const d of (data as Dest[]) ?? []) {
    const t = tokens[d.tipo];
    if (!TOKEN.test(t)) { res.push({ tipo: d.tipo, ok: false, error: "sin token" }); continue; }
    const idioma = idiomaDePais(d.pais);
    const nombre = d.nombre.replace(/\s*\(.*?\)\s*/g, " ").trim();
    const linkBaja = siteUrl(`/red?a=baja&t=${d.baja_token}`);
    const html = await render(createElement(RedInvitacionEmail, {
      idioma, tipo: d.tipo, nombre, rubro: d.tipo === "salon" ? "Salones y espacios" : "Catering y gastronomía",
      linkPanel: siteUrl(`/acceso-proveedor/${t}`), linkPerfil: null,
      linkPrecios: siteUrl(`/red?a=precios&t=${d.baja_token}`), linkBaja,
    }));
    const r = await sendMail({ to: d.email, subject: "[PRUEBA] " + asuntoRedInvitacion(idioma, nombre), html, headers: { "List-Unsubscribe": `<${linkBaja}>` } });
    res.push({ tipo: d.tipo, ...r });
    if (d.tipo === "proveedor") personaA = d.email.replace("+proveedor@", "+persona@");
  }
  if (personaA) {
    const html = await render(createElement(WelcomeLegacyEmail, { firstName: "Franco", link: siteUrl("/acceso-staff"), bajaLink: undefined }));
    const r = await sendMail({ to: personaA, subject: "[PRUEBA] Bienvenido/a a LABURO · SOMOS DER", html });
    res.push({ tipo: "persona", ...r });
  }
  return Response.json({ ok: true, res });
}
