/**
 * Wordmark oficial de LABURO, como IMAGEN REAL.
 *
 * Regla dura de marca: el lockup nunca se dibuja con la tipografía. Antes de
 * este componente había 16 lugares que escribían "LABURO." en Syne, así que
 * el logo cambiaba de forma según la pantalla y no era el oficial. El PNG
 * (`public/brand/laburo-wordmark.png`, 716x128 RGBA, letra off-white sobre
 * fondo transparente) ya existía y hasta hoy solo lo usaban los mails.
 *
 * Cómo se usa: el tamaño visible lo decide el consumidor por `className` con
 * `h-[Npx] w-auto`, que es lo que deja resolver los casos responsive sin props
 * numéricas (por ejemplo `h-[18px] md:h-[26px] w-auto`). Pasar `priority` solo
 * donde el wordmark está arriba del pliegue (header de la landing, logins).
 *
 * No lleva placa ni fondo: el PNG es transparente. No usar `unoptimized`.
 *
 * DOS SITIOS QUE NO PASAN POR ACÁ, a propósito:
 *  - `app/blog/chrome.tsx` (el eyebrow en `label-tech`): dice LABURO como
 *    etiqueta de sección, no como lockup de marca.
 *  - `components/emails/welcome-legacy-email.tsx`: la marca mencionada adentro
 *    de una frase en prosa.
 * Y los mails usan `components/emails/encabezado.tsx`, que va con el `Img` de
 * `@react-email` porque `next/image` no sirve en correo.
 */

import Image from "next/image";

export function LaburoWordmark({
  className,
  priority,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/laburo-wordmark.png"
      alt="LABURO"
      width={716}
      height={128}
      priority={priority}
      className={className}
    />
  );
}
