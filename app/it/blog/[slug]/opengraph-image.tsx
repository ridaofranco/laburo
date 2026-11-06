import { notaStaticParams } from "../../../blog/_intl/nota";
import { notaOgImage, OG_ALT, OG_SIZE } from "../../../blog/_intl/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = OG_ALT;
export const dynamicParams = false;

export function generateStaticParams() {
  return notaStaticParams("it");
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return notaOgImage("it", slug);
}
