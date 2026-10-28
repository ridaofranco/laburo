import { getPara, getAllPara } from "@/lib/para";
import { OG_SIZE, ogImage } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "LABURO. Staff, proveedores y salones para eventos";
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPara().map((p) => ({ slug: p.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getPara(slug);
  return ogImage({ kicker: p ? p.kicker || "LABURO" : "LABURO", title: p?.title ?? "LABURO" });
}
