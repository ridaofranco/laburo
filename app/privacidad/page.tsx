/**
 * PRIVACIDAD.
 *
 * ⚠️ Cada afirmación de esta página es verificable contra el código. Los datos
 * que se listan son las columnas que existen de verdad en `staff_profiles` y en
 * `organizations`; el corte del contacto es `lib/permisos.ts`; el registro de
 * suplantación es `impersonation_log`.
 *
 * Si el producto cambia qué guarda o quién lo ve, esta página cambia con él. Una
 * política de privacidad que describe otro producto es peor que no tenerla:
 * miente con formato legal.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell, Bloque } from "../legales/legal-shell";
import { SOPORTE_EMAIL } from "@/lib/soporte";

export const metadata: Metadata = {
  title: "LABURO. | Privacidad",
  description: "Qué datos guarda LABURO, quién los ve y cómo se borran.",
};

export default function PrivacidadPage() {
  return (
    <LegalShell
      titulo="Privacidad"
      bajada="Qué guardamos, quién lo ve y cómo lo sacás. Sin vueltas."
      actualizado="5 de septiembre de 2026"
    >
      <Bloque titulo="Lo más importante, primero">
        <p>
          <strong className="text-[#e5e2e1]">
            No vendemos tus datos ni se los pasamos a nadie para que te venda
            algo.
          </strong>{" "}
          No hay publicidad en LABURO y no hay rastreadores de terceros
          siguiéndote.
        </p>
        <p>
          Y algo que sostiene todo el resto:{" "}
          <strong className="text-[#e5e2e1]">
            tu contacto no está a la vista
          </strong>
          . Quien busca personal ve tu perfil y tu experiencia; el mail, el
          teléfono y el documento los ve recién cuando hay un trabajo concreto de
          por medio.
        </p>
      </Bloque>

      <Bloque titulo="Si te anotás para trabajar">
        <p>Guardamos lo que cargás en el formulario:</p>
        <ul className="flex flex-col gap-2 list-disc pl-5">
          <li>Nombre, apellido, mail y teléfono.</li>
          <li>Fecha de nacimiento y documento, si los cargás.</li>
          <li>Dónde vivís y dónde estarías dispuesto a trabajar.</li>
          <li>
            Tus oficios, tu experiencia, y el CV o portfolio si lo subís.
          </li>
          <li>
            Tu disponibilidad: si podés los fines de semana, si viajás, si tenés
            movilidad.
          </li>
        </ul>
        <p>
          Lo usamos para una sola cosa:{" "}
          <strong className="text-[#e5e2e1]">
            que alguien que necesita a alguien como vos te encuentre
          </strong>
          . Y para mandarte las ofertas de trabajo que te llegan.
        </p>
      </Bloque>

      <Bloque titulo="Si te anotás para contratar">
        <p>
          Guardamos el nombre de tu organización, tu mail y tu teléfono, más lo
          que vayas cargando después: tus eventos, las ofertas que mandás y las
          notas que le ponés a la gente.
        </p>
        <p>
          <strong className="text-[#e5e2e1]">
            Lo tuyo no se mezcla con lo de otra organización.
          </strong>{" "}
          No es una promesa: es cómo está construido, y se prueba.
        </p>
      </Bloque>

      <Bloque titulo="Quién ve tu contacto">
        <p>Solo tres situaciones:</p>
        <ul className="flex flex-col gap-2 list-disc pl-5">
          <li>
            <strong className="text-[#e5e2e1]">Vos</strong>, cuando entrás a tu
            perfil.
          </li>
          <li>
            <strong className="text-[#e5e2e1]">
              Quien te está por contratar
            </strong>
            , y solo si tiene un rol que lo habilita. Un rol de solo lectura no ve
            ni tu mail, ni tu teléfono, ni tu documento.
          </li>
          <li>
            <strong className="text-[#e5e2e1]">Nosotros</strong>, para hacer
            funcionar el servicio y responderte cuando escribís.
          </li>
        </ul>
        <p>
          ⚠️ Cuando entramos a la cuenta de una productora para resolverle un
          problema,{" "}
          <strong className="text-[#e5e2e1]">
            no vemos el mail, el teléfono ni el documento de su gente
          </strong>
          , y queda registrado que entramos, cuándo y por qué.
        </p>
      </Bloque>

      <Bloque titulo="Con quién compartimos datos">
        <p>Con nadie, salvo lo necesario para que la app funcione:</p>
        <ul className="flex flex-col gap-2 list-disc pl-5">
          <li>El servicio donde vive la base de datos y el que la hospeda.</li>
          <li>El servidor de correo, para poder mandarte los mails.</li>
          <li>
            Un servicio de inteligencia artificial que lee el CV que subís para
            completar tu perfil solo, si lo subís.
          </li>
        </ul>
        <p>
          Ninguno de ellos usa tus datos para otra cosa, y no hay ningún acuerdo
          comercial en el que tus datos sean la moneda.
        </p>
      </Bloque>

      <Bloque titulo="Cuánto tiempo">
        <p>
          Mientras tengas cuenta o ficha. Si nos pedís que te borremos, te
          borramos. Lo único que puede quedar es lo que estemos obligados a
          conservar por una ley.
        </p>
      </Bloque>

      <Bloque titulo="Tus derechos, y cómo se ejercen">
        <p>
          Podés pedirnos <strong className="text-[#e5e2e1]">ver</strong> lo que
          tenemos tuyo, <strong className="text-[#e5e2e1]">corregirlo</strong> si
          está mal, o <strong className="text-[#e5e2e1]">borrarlo</strong>. Se
          hace escribiendo a{" "}
          <a
            href={`mailto:${SOPORTE_EMAIL}`}
            className="text-[#e5e2e1] border-b border-[#4c4546] hover:border-[#e5e2e1] transition-colors"
          >
            {SOPORTE_EMAIL}
          </a>
          . No hay formulario escondido ni hay que dar explicaciones.
        </p>
        <p>
          Buena parte lo podés hacer solo desde tu perfil, sin escribirle a nadie.
        </p>
      </Bloque>

      <Bloque titulo="Si algo sale mal">
        <p>
          Si alguna vez hubiera un acceso indebido a datos personales, avisamos a
          quien esté afectado. No lo vamos a tapar.
        </p>
        <p>
          Las reglas de uso están en{" "}
          <Link
            href="/terminos"
            className="text-[#e5e2e1] border-b border-[#4c4546] hover:border-[#e5e2e1] transition-colors"
          >
            Términos
          </Link>
          .
        </p>
      </Bloque>
    </LegalShell>
  );
}
