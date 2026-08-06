/**
 * LAS CONSULTAS QUE LE LLEGARON AL PROVEEDOR.
 *
 * ── POR QUÉ ESTO EXISTE (6/8) ───────────────────────────────────────────────
 * El 6/8 entró la primera consulta real de la vidriera y el panel del proveedor
 * no la mostraba en ningún lado: tenía sus datos, sus servicios, su formulario
 * y el botón de publicarse, y nada más. Todo el producto dependía de que un
 * mail no se perdiera.
 *
 * Franco, textual: *"si bien la puede ver por correo, sino le llega, quizas
 * abriendo su panel con usuario y contraseña como hacen todos, le funciona"*.
 *
 * Es la misma lección que costó el borrador del Vigía: **que algo se haya
 * mandado no es que haya llegado**. Por eso cada consulta dice además si el
 * mail salió o no: si dice que no, esta pantalla es la única forma de que el
 * proveedor se haya enterado, y conviene que lo sepa.
 *
 * Solo lectura: contestar es escribirle a la persona, y para eso están el mail
 * y el WhatsApp, que son los canales donde el proveedor ya trabaja. No se
 * inventa una mensajería adentro de la app que después nadie mira.
 */

import { waLink } from "@/lib/wa";

export interface ConsultaProveedor {
  id: string;
  created_at: string;
  origen: string | null;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  mensaje: string | null;
  respuestas: { label?: string; valor?: string }[];
  mail_enviado: boolean;
}

function cuando(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function Consultas({ consultas }: { consultas: ConsultaProveedor[] }) {
  if (consultas.length === 0) {
    return (
      <p className="text-body text-fg-muted">
        Todavía no te consultó nadie. Cuando alguien te escriba desde tu ficha,
        la consulta te llega a tu mail y además te queda acá, para que no
        dependas de encontrarla en la casilla.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-md">
      {consultas.map((c) => {
        const wa = c.telefono ? waLink(c.telefono, `Hola ${c.nombre ?? ""}, te escribo por la consulta que me dejaste en LABURO.`) : null;
        return (
          <article
            key={c.id}
            className="flex flex-col gap-sm rounded-2xl bg-surface-1 border border-border p-md"
          >
            <header className="flex flex-wrap items-baseline justify-between gap-xs">
              <p className="text-body font-semibold text-fg break-words">
                {c.nombre?.trim() || "Sin nombre"}
              </p>
              <span className="text-label text-fg-subtle">{cuando(c.created_at)}</span>
            </header>

            {/* Las respuestas del formulario, tal cual las contestó. Es el
                contenido de la consulta: sin esto la pantalla diría "te
                consultaron" y no qué te consultaron. */}
            {c.respuestas?.length ? (
              <dl className="flex flex-col gap-2xs">
                {c.respuestas.map((r, i) => (
                  <div key={i} className="flex flex-col gap-3xs">
                    <dt className="text-label text-fg-subtle">{r.label}</dt>
                    <dd className="text-body text-fg break-words">{r.valor || "—"}</dd>
                  </div>
                ))}
              </dl>
            ) : c.mensaje ? (
              <p className="text-body text-fg whitespace-pre-wrap break-words">{c.mensaje}</p>
            ) : null}

            {/* Contestar. El mail va primero porque es donde queda registro. */}
            <div className="flex flex-wrap items-center gap-md pt-2xs">
              {c.email ? (
                <a
                  href={`mailto:${c.email}?subject=${encodeURIComponent("Tu consulta en LABURO")}`}
                  className="text-label font-semibold text-fg underline underline-offset-4"
                >
                  Contestar por mail
                </a>
              ) : null}
              {wa ? (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-label font-semibold text-fg underline underline-offset-4"
                >
                  WhatsApp
                </a>
              ) : null}
            </div>

            <p className="text-label text-fg-subtle break-words">
              {c.email}
              {c.telefono ? ` · ${c.telefono}` : ""}
              {c.mail_enviado ? "" : " · ⚠️ el aviso por mail no salió"}
            </p>
          </article>
        );
      })}
    </div>
  );
}
