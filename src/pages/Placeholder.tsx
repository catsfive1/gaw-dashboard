export function Placeholder({ title }: { title: string }) {
  return (
    <section>
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      <p className="mt-2 text-sm text-muted">loading...</p>
    </section>
  );
}
