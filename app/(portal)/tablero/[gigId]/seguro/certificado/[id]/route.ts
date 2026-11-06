import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { certificado, mecubroActivo } from "@/lib/mecubro";
import { gigDelUsuario, type SeguroGuardado } from "../../actions";

/** PDF del certificado de MeCubro, solo para gente de la organización del evento. */
export async function GET(_req: Request, { params }: { params: Promise<{ gigId: string; id: string }> }) {
  const { gigId, id } = await params;
  if (!mecubroActivo()) return new NextResponse("No disponible", { status: 404 });
  const gig = await gigDelUsuario(gigId);
  if (!gig) return new NextResponse("No encontrado", { status: 404 });
  const { data } = await createServiceRoleClient().rpc("staff_app_seguros_del_gig", { p_gig: gigId });
  const s = ((data as SeguroGuardado[] | null) ?? []).find((x) => x.id === id);
  if (!s) return new NextResponse("No encontrado", { status: 404 });
  const r = await certificado(s.mecubro_uuid);
  if (!r.ok) return new NextResponse("El certificado está listo cuando MeCubro registra el pago.", { status: 409 });
  return new NextResponse(r.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="seguro-${s.codigo ?? s.id}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
