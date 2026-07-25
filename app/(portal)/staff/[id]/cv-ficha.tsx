/**
 * LA FICHA DEL CV, ESCRITA.
 *
 * Reemplaza al visor de PDF como forma principal de ver el CV de alguien del pool.
 *
 * POR QUÉ IMPORTA:
 *  1. En julio se extrajeron 660 CVs con Gemini a `cv_data` justamente para esto, y
 *     el paso de volcarlo a la pantalla nunca se había hecho: la app seguía
 *     mostrando el PDF que la persona subió a Drive.
 *  2. **Privacidad.** El PDF original tiene el teléfono y el mail adentro del
 *     archivo, así que el visor de PDF mostraba el contacto aunque el modelo broker
 *     diga que no se muestra. La ficha escrita solo tiene experiencia y formación.
 *  3. Se lee en dos segundos. Un PDF hay que abrirlo, esperarlo y escanearlo con la
 *     vista; cuando hay que armar un equipo de 8 personas, eso no escala.
 *
 * El PDF NO se saca: queda a un click, para el caso de que la extracción haya
 * quedado incompleta o haya que ver el original. Y si una ficha no tiene `cv_data`
 * (18 de los 688 no se pudieron leer), esta pantalla no se muestra y queda el PDF
 * como estaba: nadie pierde nada.
 *
 * Server component: no necesita interactividad.
 */

import type { CvFichaData, CvItem } from "@/lib/cv-ficha";

function Item({ it }: { it: CvItem }) {
  return (
    <li className="flex flex-col gap-1 border-l-2 border-[#1A1A1A] pl-4">
      <span className="text-body font-semibold text-fg">{it.titulo}</span>
      {it.lugar || it.periodo ? (
        <span className="text-label font-normal text-fg-muted">
          {[it.lugar, it.periodo].filter(Boolean).join(" · ")}
        </span>
      ) : null}
      {it.detalle ? (
        <span className="text-label font-normal leading-relaxed text-[#cfc4c5] whitespace-pre-line">
          {it.detalle}
        </span>
      ) : null}
    </li>
  );
}

function Chips({ valores }: { valores: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {valores.map((v) => (
        <span
          key={v}
          className="rounded-full border border-[#1A1A1A] bg-surface-1 px-3 py-1 text-label font-normal text-[#cfc4c5]"
        >
          {v}
        </span>
      ))}
    </div>
  );
}

export function CvFicha({ data }: { data: CvFichaData }) {
  if (!data.hayAlgo) return null;

  return (
    <div className="flex flex-col gap-6">
      {data.titular ? (
        <p className="text-body leading-relaxed text-fg whitespace-pre-line">{data.titular}</p>
      ) : null}

      {data.experiencia.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h3 className="label-tech text-[11px] text-fg-muted">Experiencia</h3>
          <ul className="flex flex-col gap-4">
            {data.experiencia.map((it, i) => (
              <Item key={`exp-${i}`} it={it} />
            ))}
          </ul>
        </div>
      ) : null}

      {data.formacion.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h3 className="label-tech text-[11px] text-fg-muted">Formación</h3>
          <ul className="flex flex-col gap-4">
            {data.formacion.map((it, i) => (
              <Item key={`for-${i}`} it={it} />
            ))}
          </ul>
        </div>
      ) : null}

      {data.oficios.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h3 className="label-tech text-[11px] text-fg-muted">Del CV</h3>
          <Chips valores={data.oficios} />
        </div>
      ) : null}

      {data.idiomas.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h3 className="label-tech text-[11px] text-fg-muted">Idiomas</h3>
          <Chips valores={data.idiomas} />
        </div>
      ) : null}
    </div>
  );
}
