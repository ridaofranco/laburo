import { IndiceIntl, indiceMetadata } from "../../blog/_intl/indice";

// Blog traducido: todo el código vive en app/blog/_intl (ver editorial/BLOG-5-IDIOMAS.md).
// Carpeta fija por idioma a propósito: un app/[lang] de primer nivel hace que la
// regla no-html-link-for-pages de next build tome cualquier <a href="/x"> como página.
export const metadata = indiceMetadata("en");

export default function Page() {
  return <IndiceIntl lang="en" />;
}
