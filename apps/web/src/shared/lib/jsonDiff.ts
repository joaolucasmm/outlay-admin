export type DiffKind = 'added' | 'removed' | 'changed';

export interface DiffEntry {
  /** Keys from the root to the changed value, e.g. `['cat_meals:manager', 'limitMinor']`. */
  path: string[];
  kind: DiffKind;
  before?: unknown;
  after?: unknown;
}

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Missing, `undefined` and `null` all mean "no value here". */
const isAbsent = (value: unknown) => value === undefined || value === null;

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => deepEqual(item, b[i]));
  }
  if (isObject(a) && isObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((key) => deepEqual(a[key], b[key]));
  }
  return false;
}

/**
 * Field-level differences between two JSON values (an audit event's `before` and
 * `after`). Objects are compared key by key, recursively; an object that appears or
 * disappears as a whole (e.g. a policy rule added, or a record created) is reported
 * field by field, so the UI can show every value. Arrays and scalars are compared whole.
 */
export function diffJson(before: unknown, after: unknown, path: string[] = []): DiffEntry[] {
  if (deepEqual(before, after)) return [];

  const beforeIsObject = isObject(before);
  const afterIsObject = isObject(after);
  if ((beforeIsObject || isAbsent(before)) && (afterIsObject || isAbsent(after))) {
    const b = beforeIsObject ? before : {};
    const a = afterIsObject ? after : {};
    const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].sort();
    return keys.flatMap((key) => diffJson(b[key], a[key], [...path, key]));
  }

  if (isAbsent(before)) return [{ path, kind: 'added', after }];
  if (isAbsent(after)) return [{ path, kind: 'removed', before }];
  return [{ path, kind: 'changed', before, after }];
}
