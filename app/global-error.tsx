"use client";

/**
 * Último recurso: si falla el layout raíz, Next muestra esto en lugar de su
 * pantalla en inglés. Tiene que traer su propio <html> y no puede depender de
 * los estilos del layout, por eso va con estilos en línea.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es-AR">
      <body style={{ margin: 0, background: "#000", color: "#e5e2e1", fontFamily: "system-ui, sans-serif" }}>
        <main
          style={{
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 24px",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 28, margin: 0 }}>No pudimos cargar LABURO</h1>
          <p style={{ fontSize: 17, color: "#cfc4c5", maxWidth: 420, lineHeight: 1.6 }}>
            Fue un problema nuestro. Probá de nuevo en un momento.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 24,
              border: "1px solid #e5e2e1",
              background: "transparent",
              color: "#e5e2e1",
              padding: "14px 28px",
              fontSize: 13,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Probar de nuevo
          </button>
          {error.digest ? (
            <p style={{ marginTop: 32, fontSize: 12, color: "#8a8a8a" }}>Código: {error.digest}</p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
