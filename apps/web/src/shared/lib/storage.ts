/** Reads JSON from storage; anything missing, unreadable or failing `guard` is `undefined`. */
export function loadJson<T>(
  storage: Storage,
  key: string,
  guard: (value: unknown) => value is T,
): T | undefined {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(key) ?? 'null');
    return guard(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** Writes JSON to storage, ignoring a full or blocked storage. */
export function saveJson(storage: Storage, key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the value just won't survive a reload.
  }
}
