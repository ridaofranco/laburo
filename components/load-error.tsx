/**
 * Estado de error de carga para páginas server (RSC). Se muestra cuando una query
 * a Supabase devuelve `error` (no confundir con "no hay datos": un error de red o
 * de permisos NO es lo mismo que una lista vacía). Honesto en vez de mostrar un
 * vacío engañoso. Server-renderable (sin "use client").
 */
export function LoadError({ what = "los datos" }: { what?: string }) {
  return (
    <div className="border border-[#4c4546] bg-[#0e0e0e] p-8 text-center">
      <p className="text-[16px] text-[#e5e2e1]">No pudimos cargar {what}.</p>
      <p className="mt-2 text-[13px] text-[#cfc4c5]">
        Recargá la página o probá de nuevo en un momento.
      </p>
    </div>
  );
}
