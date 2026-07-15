/**
 * Home del dashboard (shell). La búsqueda (SRCH-01/02) llega en 02-03;
 * esto solo confirma que un admin autorizado aterriza adentro del gate.
 */
export default function DashboardPage() {
  return (
    <section className="flex flex-col gap-sm">
      <h1 className="text-heading font-semibold text-fg">Buscá gente</h1>
      <p className="text-body text-fg-muted">
        Acá vas a poder buscar y filtrar a los candidatos de tu pool.
      </p>
    </section>
  );
}
