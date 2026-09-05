/**
 * TÉRMINOS DE USO.
 *
 * Escritos en criollo y describiendo lo que el producto HACE HOY, no lo que
 * podría hacer. Cada afirmación de acá es verificable contra el código: si el
 * producto cambia, esta página cambia con él.
 *
 * ⚠️ Lo que NO se hace acá: prometer disponibilidad que no se puede sostener,
 * decir que se cobra cuando no se cobra, ni llenar de cláusulas copiadas de otro
 * lado. Un término que no se cumple es peor que no tenerlo.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell, Bloque } from "../legales/legal-shell";
import { SOPORTE_EMAIL } from "@/lib/soporte";

export const metadata: Metadata = {
  title: "LABURO. | Términos de uso",
  description: "Las reglas de uso de LABURO, en criollo.",
};

export default function TerminosPage() {
  return (
    <LegalShell
      titulo="Términos de uso"
      bajada="Las reglas, cortas y en criollo. Si algo de acá no se entiende, escribinos y lo reescribimos."
      actualizado="5 de septiembre de 2026"
    >
      <Bloque titulo="Qué es LABURO">
        <p>
          LABURO es una herramienta para que quien organiza eventos encuentre
          personal, le mande ofertas de trabajo y coordine la contratación. Lo
          hace <strong className="text-[#e5e2e1]">SOMOS DER</strong>.
        </p>
        <p>
          LABURO <strong className="text-[#e5e2e1]">no es el empleador</strong> de
          nadie. La relación laboral, el pago y las obligaciones que correspondan
          son entre quien contrata y quien trabaja. Nosotros ponemos la
          herramienta donde se encuentran.
        </p>
      </Bloque>

      <Bloque titulo="Hoy es gratis">
        <p>
          No cobramos comisión ni acceso. Es una decisión comercial, no una
          promesa eterna:{" "}
          <strong className="text-[#e5e2e1]">
            si algún día empezamos a cobrar, lo vamos a avisar antes
          </strong>{" "}
          y nadie va a encontrarse con un cargo sorpresa.
        </p>
      </Bloque>

      <Bloque titulo="Quién se puede anotar">
        <p>
          Cualquiera que necesite personal para un evento: productoras,
          agencias, marcas, empresas o alguien organizando algo por su cuenta.
          <strong className="text-[#e5e2e1]"> Nadie aprueba tu cuenta</strong>: te
          anotás y operás.
        </p>
        <p>
          Para trabajar como staff hay que ser mayor de edad y poder trabajar
          legalmente en el país donde va a ser el evento.
        </p>
      </Bloque>

      <Bloque titulo="Lo que esperamos de vos">
        <ul className="flex flex-col gap-2 list-disc pl-5">
          <li>Que los datos que cargues sean tuyos y sean ciertos.</li>
          <li>
            Que uses los datos de contacto de otra persona{" "}
            <strong className="text-[#e5e2e1]">solo para el trabajo</strong> por
            el que la contactaste. No para venderle nada, no para armar una
            base, no para pasárselos a un tercero.
          </li>
          <li>Que no publiques ofertas de trabajo falsas ni engañosas.</li>
          <li>Que no intentes entrar a la cuenta ni a los datos de otro.</li>
        </ul>
        <p>
          Si algo de esto pasa, podemos bajar la publicación o cerrar la cuenta.
          Cuando lo hacemos, decimos por qué.
        </p>
      </Bloque>

      <Bloque titulo="Lo que podés esperar de nosotros">
        <ul className="flex flex-col gap-2 list-disc pl-5">
          <li>
            Que tus datos no se mezclen con los de otra organización. Está
            construido así desde el primer día y se prueba.
          </li>
          <li>
            Que si entramos a tu cuenta para resolverte un problema,{" "}
            <strong className="text-[#e5e2e1]">quede registrado</strong>, y que
            desde adentro <strong className="text-[#e5e2e1]">no veamos</strong> el
            mail, el teléfono ni el documento de tu gente.
          </li>
          <li>Que te avisemos antes de cualquier cambio que te afecte.</li>
        </ul>
        <p>
          Lo que <strong className="text-[#e5e2e1]">no</strong> podemos
          prometerte: que el servicio nunca se caiga. Es un producto joven, lo
          mantiene un equipo chico, y preferimos decirlo a inventar un número de
          disponibilidad que no vamos a poder sostener. Si se cae, lo arreglamos
          y te contamos qué pasó.
        </p>
      </Bloque>

      <Bloque titulo="Si querés irte">
        <p>
          Escribinos a{" "}
          <a
            href={`mailto:${SOPORTE_EMAIL}`}
            className="text-[#e5e2e1] border-b border-[#4c4546] hover:border-[#e5e2e1] transition-colors"
          >
            {SOPORTE_EMAIL}
          </a>{" "}
          y damos de baja tu cuenta y tus datos. No hay permanencia, no hay que
          avisar con anticipación, y no vas a tener que buscar un botón escondido.
        </p>
      </Bloque>

      <Bloque titulo="Cambios">
        <p>
          Si cambiamos estos términos de una manera que te afecte, avisamos por
          mail antes de que empiece a regir. La fecha de arriba dice cuándo fue
          la última vez.
        </p>
        <p>
          Cómo tratamos tus datos está en{" "}
          <Link
            href="/privacidad"
            className="text-[#e5e2e1] border-b border-[#4c4546] hover:border-[#e5e2e1] transition-colors"
          >
            Privacidad
          </Link>
          .
        </p>
      </Bloque>
    </LegalShell>
  );
}
