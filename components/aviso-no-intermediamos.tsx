/**
 * AVISO «LABURO NO CONTRATA NI INTERMEDIA» (Franco 31/10, plan del cambio de LABURO).
 *
 * Texto tal cual de trabajo/laburo-legal/TERMINOS-PROPUESTOS.md, sección
 * «AVISOS VISIBLES». Va en cada oferta (versión larga en la oferta y arriba de
 * la lista, corta en cada tarjeta) y en el formulario de publicar.
 *
 * Si cambia el texto legal, se cambia SOLO acá.
 */

export const AVISO_CORTO =
  "Ni LABURO ni SOMOS DER contratan ni son intermediarios. La responsable es quien publica. Nunca pagues para trabajar.";

export function avisoLargo(quienPublica?: string | null) {
  const quien = quienPublica?.trim() ? quienPublica.trim() : "quien la publica";
  return `Ni LABURO ni SOMOS DER contratan, emplean ni son intermediarios. Esta oferta la publica ${quien}, que es la única responsable de lo que ofrece y de contratar, registrar, asegurar y pagarle a quien trabaje. Lo que acuerden es una relación privada entre ustedes. LABURO nunca te va a cobrar por postularte ni por conseguir trabajo: si te piden plata, la oferta discrimina o parece falsa, denunciala.`;
}

export const AVISO_PUBLICAR =
  "Ni LABURO ni SOMOS DER contratan, emplean ni son intermediarios. LABURO solo publica tu oferta. Vos sos el único responsable de elegir, contratar, registrar, asegurar (ART o seguro) y pagarle a quien trabaje, y de cumplir la ley laboral, impositiva y de seguridad social. Lo que acuerdes es una relación privada entre vos y esa persona.";

export const DECLARACION_PUBLICAR =
  "Declaro bajo juramento que la información es verdadera, que tengo facultades para publicar en nombre de mi empresa, que voy a contratar en forma legal, que no le voy a cobrar nada a quien se postule y que la oferta no discrimina por edad, sexo, apariencia, nacionalidad ni ningún otro motivo. Acepto los Términos y Condiciones.";

/** Bloque visible, con borde de color para que no pase de largo. */
export function AvisoNoIntermediamos({
  texto,
  className = "",
  color = "text-[#d8d2c4]",
}: {
  texto: string;
  className?: string;
  /** Clase de color del texto; en pantallas con tema (claro u oscuro) pasar "text-fg". */
  color?: string;
}) {
  return (
    <p
      role="note"
      className={`text-[13px] leading-[1.55] font-semibold uppercase tracking-[0.02em] break-words border-l-2 border-[#c9a227] pl-3 ${color} ${className}`}
    >
      {texto}
    </p>
  );
}
