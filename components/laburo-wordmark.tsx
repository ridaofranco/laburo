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
 * numéricas (por ejemplo `h-[9px] md:h-[13px] w-auto`). Pasar `priority` solo
 * donde el wordmark está arriba del pliegue (header de la landing, logins).
 *
 * ── ⚠️ EL PNG SE RECORTÓ EL 3/8, Y POR ESO CAMBIARON TODAS LAS ALTURAS ───────
 * El archivo era 716x128 pero las letras ocupaban SOLO 66px de alto: tenía 29px
 * transparentes arriba y 33px abajo, o sea que casi la mitad de la caja era aire
 * invisible. Consecuencia: `h-[22px]` en el footer dibujaba letras de ~11px, el
 * mismo tamaño que la línea de copyright de al lado, y encima metía ~5px de
 * relleno fantasma que rompía el `gap`. Franco: "el footer tiene horrible el
 * logo". Tenía razón, y el problema estaba en el archivo, no en el CSS.
 *
 * Ahora el PNG es 690x66, al ras. `h-[N]` pasó a significar la altura REAL de
 * las letras, así que todas las llamadas se recalcularon ×(66/128) para que se
 * vean idénticas a como se veían. La única que subió a propósito es la del
 * footer de la landing, que era la que estaba mal.
 *
 * Si algún día se vuelve a exportar el wordmark: que salga SIN relleno. Un PNG
 * con aire transparente arriba y abajo hace que ningún número de CSS signifique
 * lo que parece.
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
      width={690}
      height={66}
      priority={priority}
      className={className}
    />
  );
}
