interface PlaceholderPageProps {
  title: string;
  /** Roadmap milestone that will build this screen. */
  milestone?: string;
}

export function PlaceholderPage({ title, milestone }: PlaceholderPageProps) {
  return (
    <section aria-labelledby="page-title">
      <h1 id="page-title" className="text-2xl font-semibold tracking-tight">
        {title}
      </h1>
      {milestone && (
        <p className="mt-2 text-sm text-slate-600">This screen lands in milestone {milestone}.</p>
      )}
    </section>
  );
}
