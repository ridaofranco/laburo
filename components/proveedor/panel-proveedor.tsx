/**
 * EL PANEL DEL PROVEEDOR, uno solo para las dos puertas.
 *
 * Lo renderizan `/acceso-proveedor/[token]` (link mágico, sin cuenta) y
 * `/mi-proveedor` (sesión). Recibe un `Acceso` y no sabe nada más: quién entró
 * y cómo lo resuelve la base adentro de cada RPC.
 *
 * ── POR QUÉ COMPARTIDO Y NO DUPLICADO ───────────────────────────────────────
 * Las dos puertas muestran y escriben exactamente lo mismo. Copiar la pantalla
 * es la forma más rápida de que en tres meses una tenga un campo que la otra no,
 * y que nadie sepa cuál es la buena. Ya pasó con las dos familias de funciones
 * de la base, que estuvieron un mes desincronizadas porque una nunca se conectó.
 */

import type { CampoFormulario } from "@/lib/formulario-consulta";
import type { Acceso } from "@/lib/proveedor-acceso";
import type { PerfilProveedor } from "@/app/acceso-proveedor/[token]/estados";
import { PerfilForm } from "@/app/acceso-proveedor/[token]/perfil-form";
import { Servicios } from "@/app/acceso-proveedor/[token]/servicios";
import { Publicar } from "@/app/acceso-proveedor/[token]/publicar";
import { Formulario } from "@/app/acceso-proveedor/[token]/formulario";
import { Consultas, type ConsultaProveedor } from "./consultas";

/** Bloque de la pantalla, con su título. El proveedor los recorre en orden. */
function Bloque({
  titulo,
  bajada,
  children,
}: {
  titulo: string;
  bajada?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-sm">
      <div className="flex flex-col gap-3xs">
        <h2 className="font-display text-[20px] text-fg">{titulo}</h2>
        {bajada ? <p className="text-label text-fg-subtle">{bajada}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function PanelProveedor({
  acceso,
  data,
  form,
  consultas,
}: {
  acceso: Acceso;
  data: PerfilProveedor;
  form: { campos?: CampoFormulario[]; intro?: string | null } | null;
  consultas: ConsultaProveedor[];
}) {
  const { perfil, servicios } = data;
  const nombre = (perfil.display_name ?? "").trim();

  return (
    <div className="flex flex-col gap-lg pt-md">
      <header className="flex flex-col gap-xs">
        <h1 className="font-display text-[32px] text-fg">
          {nombre ? `Hola ${nombre}` : "Hola"}
        </h1>
        <p className="text-body text-fg-muted">
          Este es tu perfil de proveedor. Completalo, cargá los servicios que
          prestás y publicate para que las productoras te encuentren. Cuando
          alguien te quiera contratar, la consulta te llega a tu mail.
        </p>
      </header>

      {/* Estado actual, todo de lectura. El sello de verificado se muestra y se
          explica en una línea, para que nadie lo busque como un interruptor:
          lo activa DER, no el que se verifica a sí mismo. */}
      <div className="flex flex-col gap-sm rounded-2xl bg-surface-1 border border-border p-md">
        <div className="flex items-center justify-between gap-md">
          <span className="text-label text-fg-muted">Estado</span>
          <span
            className={`text-label font-semibold ${perfil.is_public ? "text-positive" : "text-fg"}`}
          >
            {perfil.is_public ? "Publicado" : "Todavía sin publicar"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-md">
          <span className="text-label text-fg-muted">Verificado por DER</span>
          <span className="text-label font-semibold text-fg">
            {perfil.is_verified ? "Sí" : "Todavía no"}
          </span>
        </div>
        <p className="text-label text-fg-subtle">
          La verificación la activa DER después de trabajar con vos. No es algo
          que puedas cambiar desde acá.
        </p>
      </div>

      {/* LAS CONSULTAS VAN PRIMERO, arriba de todo (6/8). Es lo unico que puede
          ser URGENTE cuando el proveedor entra: alguien le pidio un presupuesto
          para una fecha. Sus datos y sus servicios pueden esperar; una consulta
          de hace tres dias sin contestar, no. */}
      <Bloque
        titulo="Mis consultas"
        bajada="Quién te pidió presupuesto. También te llegan por mail."
      >
        <Consultas consultas={consultas} />
      </Bloque>

      {/* Los tres bloques van en el orden en que el proveedor los usa: primero
          quién es, después qué hace, y al final publicarse. Una columna, cada
          bloque con su título, para que en el teléfono se entienda solo. */}
      <Bloque titulo="Mis datos" bajada="Lo que ve la productora cuando te encuentra.">
        <PerfilForm acceso={acceso} perfil={perfil} />
      </Bloque>

      <Bloque titulo="Mis servicios" bajada="Qué prestás y en qué provincias trabajás.">
        <Servicios acceso={acceso} servicios={servicios ?? []} />
      </Bloque>

      {/* Va DESPUÉS de los servicios y ANTES de publicarse a propósito: es lo
          último que define cómo te llegan los pedidos, y lo primero que
          conviene tener listo el día que te publicás. */}
      <Bloque
        titulo="Cómo quiero que me consulten"
        bajada="Lo que le vamos a preguntar a quien te pida un presupuesto. Te llega a tu mail ya completo."
      >
        <Formulario
          acceso={acceso}
          camposIniciales={form?.campos ?? []}
          introInicial={form?.intro ?? null}
        />
      </Bloque>

      <Bloque titulo="Publicarme">
        <Publicar acceso={acceso} publicado={perfil.is_public} />
      </Bloque>
    </div>
  );
}
