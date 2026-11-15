/**
 * Human-readable message from an RTK Query error carrying RFC 9457 Problem Details.
 * Falls back to `fallback` for network errors or unexpected bodies.
 */
export function problemMessage(
  error: unknown,
  fallback = 'Something went wrong. Try again.',
): string {
  if (typeof error !== 'object' || error === null || !('data' in error)) return fallback;
  const data = error.data;
  if (typeof data !== 'object' || data === null) return fallback;
  if ('detail' in data && typeof data.detail === 'string') return data.detail;
  if ('title' in data && typeof data.title === 'string') return data.title;
  return fallback;
}

/** Field-level errors (`errors[]`) from Problem Details, if any. */
export function problemFieldErrors(error: unknown): { field: string; message: string }[] {
  if (typeof error !== 'object' || error === null || !('data' in error)) return [];
  const data = error.data;
  if (typeof data !== 'object' || data === null || !('errors' in data)) return [];
  const errors: unknown = data.errors;
  if (!Array.isArray(errors)) return [];
  return (errors as unknown[]).filter(
    (e): e is { field: string; message: string } =>
      typeof e === 'object' &&
      e !== null &&
      'field' in e &&
      typeof e.field === 'string' &&
      'message' in e &&
      typeof e.message === 'string',
  );
}
