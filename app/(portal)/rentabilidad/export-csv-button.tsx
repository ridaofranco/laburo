"use client";

/**
 * Botón de export CSV (client island) para la tabla de staff confirmado.
 * Genera el CSV en el browser (Blob + download), cero backend, cero costo.
 * Recibe filas ya listas desde el server component.
 */

export interface CsvRow {
  nombre: string;
  gig: string;
  monto: string;
  fecha: string;
}

function toCsv(rows: CsvRow[]): string {
  const header = ["Staff", "Evento", "Monto", "Fecha"];
  // Anti CSV formula-injection: si el valor arranca con = + - @ (o tab/CR), Excel
  // y Sheets lo ejecutan como fórmula. Prefijamos un apóstrofo para neutralizarlo.
  const deFormula = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
  const esc = (v: string) => `"${deFormula(v).replace(/"/g, '""')}"`;
  const lines = [
    header.map(esc).join(","),
    ...rows.map((r) => [r.nombre, r.gig, r.monto, r.fecha].map(esc).join(",")),
  ];
  return lines.join("\n");
}

export function ExportCsvButton({ rows }: { rows: CsvRow[] }) {
  function download() {
    if (rows.length === 0) return;
    const blob = new Blob(["﻿" + toCsv(rows)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "laburo-staff-confirmado.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={rows.length === 0}
      className="label-tech text-[12px] text-[#e5e2e1] border border-[#4c4546] px-4 py-2 hover:bg-[#e5e2e1] hover:text-[#131313] transition-colors duration-150 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#e5e2e1]"
    >
      Exportar CSV
    </button>
  );
}
