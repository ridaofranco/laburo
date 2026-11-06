import type { Metadata } from "next";
import { NotaIntl, notaMetadata, notaStaticParams } from "../../../blog/_intl/nota";

export const dynamicParams = false;

export function generateStaticParams() {
  return notaStaticParams("fr");
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return notaMetadata("fr", slug);
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <NotaIntl lang="fr" slug={slug} />;
}
