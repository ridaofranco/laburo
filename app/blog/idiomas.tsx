import Link from "next/link";
import { type BlogPost, IDIOMAS, versionesDe } from "@/lib/blog";
import { ETIQUETA_IDIOMA } from "@/lib/blog-i18n";

/**
 * Selector de idioma de una nota (06/11/2026): ES · EN · PT · FR · IT, solo con
 * las versiones que existen. Si la nota no tiene traducciones no muestra nada.
 * Es el mismo grupo que arma el hreflang (versionesDe en lib/blog.ts).
 */
export function SelectorIdioma({ post }: { post: BlogPost }) {
  const grupo = versionesDe(post);
  const disponibles = IDIOMAS.filter((l) => grupo[l]);
  if (disponibles.length < 2) return null;
  return (
    <nav aria-label="Idioma / Language" className="mt-8">
      <ul className="flex flex-wrap items-center gap-2 label-tech text-[10px] tracking-[0.2em]">
        {disponibles.map((l) => {
          const p = grupo[l]!;
          const actual = l === post.lang;
          const href = new URL(p.canonical).pathname;
          return (
            <li key={l}>
              {actual ? (
                <span aria-current="true" className="inline-flex min-h-[32px] items-center rounded-full border border-[#0047ff] px-3 text-[#0047ff]">
                  {ETIQUETA_IDIOMA[l]}
                </span>
              ) : (
                <Link
                  href={href}
                  hrefLang={l}
                  lang={l}
                  className="inline-flex min-h-[32px] items-center rounded-full border border-[#262626] px-3 text-[#8a8a8a] hover:border-[#0047ff] hover:text-[#0047ff] transition-colors"
                >
                  {ETIQUETA_IDIOMA[l]}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
