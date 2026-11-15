import { useGetHealthQuery } from './api';

const dotClass = {
  loading: 'bg-slate-400',
  error: 'bg-red-500',
  ok: 'bg-emerald-500',
} as const;

/** Small header badge showing whether the API (or the MSW mock) answers. */
export function ApiStatus() {
  const { data, isLoading, isError } = useGetHealthQuery(undefined);

  const [state, text] = isLoading
    ? (['loading', 'Checking API…'] as const)
    : isError || !data
      ? (['error', 'API unreachable'] as const)
      : (['ok', `${data.mode === 'mock' ? 'Mock' : 'Live'} API: ${data.status}`] as const);

  return (
    <p role="status" className="flex items-center gap-2 text-sm text-slate-600">
      <span aria-hidden="true" className={`size-2 rounded-full ${dotClass[state]}`} />
      {text}
    </p>
  );
}
