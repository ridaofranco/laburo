import { getPost, getAllPosts } from "@/lib/blog";
import { OG_SIZE, ogImage } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "LABURO. Staff, proveedores y salones para eventos";
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getPost(slug);
  return ogImage({ kicker: p ? p.kicker : "LABURO", title: p?.title ?? "LABURO" });
}
