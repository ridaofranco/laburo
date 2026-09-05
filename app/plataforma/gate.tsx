/**
 * El corte de CONTEXTO de las pantallas de plataforma.
 *
 * ── DOS CORTES DISTINTOS, Y LOS DOS TIENEN QUE PASAR ────────────────────────
 *
 *  · **Permiso** (el de verdad): `is_platform_admin()` adentro de las RPC de la
 *    0054. Vive en la base y no se decide en ninguna pantalla. Si no lo tenés,
 *    las RPC devuelven vacío.
 *
 *  · **Contexto** (esto): la organización ELEGIDA en el selector tiene que ser
 *    la plataforma. Hallazgo del 5/9: con otra productora elegida, el ítem
 *    desaparecía del menú y /leads y /rentabilidad daban 404, pero /plataforma
 *    seguía mostrando el panel real. Nunca fue un agujero (el permiso es por
 *    usuario), pero la persona decía "estoy operando la productora B" y el
 *    producto le contestaba con el panel de la plataforma.
 *
 * La regla elegida: **mientras actuás como otra productora, no sos la
 * plataforma.** No le saca el permiso a nadie ni toca la base; se sale del
 * contexto y la pantalla vuelve. Y aplica igual a la suplantación, que es el
 * caso donde más importa: operando la cuenta de un cliente, la pantalla que
 * mira a todos los clientes desde arriba no corresponde.
 *
 * ⚠️ Esto NO reemplaza al gate de permiso. Las pantallas siguen chequeando
 * `resumen.ok` después: un corte de contexto que se saltee con una cookie no
 * puede ser lo único que separa a alguien del panel de la plataforma.
 */

import { LaburoWordmark } from "@/components/laburo-wordmark";
import { orgActual } from "@/lib/org";

/**
 * Devuelve la pantalla de "estás en otro contexto" cuando la organización
 * elegida no es la plataforma, y `null` cuando se puede seguir.
 */
export async function cortePorContexto(): Promise<React.ReactNode | null> {
  const org = await orgActual();
  if (org?.esPlataforma) return null;

  return (
    <main className="min-h-dvh bg-black text-[#e5e2e1] flex flex-col items-center justify-center px-6 gap-6">
      <LaburoWordmark className="h-[48px] w-auto" />
      <p className="text-[16px] text-[#cfc4c5] text-center max-w-[440px] leading-[1.6]">
        Ahora mismo estás operando{" "}
        <strong className="text-[#e5e2e1]">{org?.nombre ?? "otra productora"}</strong>, y
        esta pantalla es la de la plataforma. Cambiá de productora en el selector para
        volver a entrar.
      </p>
      <a
        href="/dashboard"
        className="label-tech text-[12px] uppercase tracking-widest text-[#cfc4c5] hover:text-[#e5e2e1] border-b border-[#4c4546] hover:border-[#e5e2e1] pb-1 transition-colors"
      >
        Ir a mi panel
      </a>
    </main>
  );
}
