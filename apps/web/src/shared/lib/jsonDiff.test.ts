import { describe, expect, it } from 'vitest';
import { deepEqual, diffJson } from './jsonDiff';

describe('deepEqual', () => {
  it.each([
    [1, 1, true],
    [{ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }, true],
    [[1, 2], [1, 2, 3], false],
    [{ a: 1 }, { a: 1, b: 2 }, false],
    [{ a: 1 }, [1], false],
    ['1', 1, false],
  ])('%j vs %j → %s', (a, b, expected) => {
    expect(deepEqual(a, b)).toBe(expected);
  });
});

describe('diffJson', () => {
  it('returns nothing for equal values', () => {
    expect(diffJson({ a: 1 }, { a: 1 })).toEqual([]);
  });

  it('reports changed, added and removed fields, sorted by key', () => {
    expect(diffJson({ status: 'active', old: 1 }, { status: 'suspended', reason: 'x' })).toEqual([
      { path: ['old'], kind: 'removed', before: 1 },
      { path: ['reason'], kind: 'added', after: 'x' },
      { path: ['status'], kind: 'changed', before: 'active', after: 'suspended' },
    ]);
  });

  it('recurses into nested objects', () => {
    expect(
      diffJson({ r: { limit: 100, receipt: 10 } }, { r: { limit: 200, receipt: 10 } }),
    ).toEqual([{ path: ['r', 'limit'], kind: 'changed', before: 100, after: 200 }]);
  });

  it('expands an object that appears or disappears (null or missing)', () => {
    expect(diffJson({ r: null }, { r: { limit: 1 } })).toEqual([
      { path: ['r', 'limit'], kind: 'added', after: 1 },
    ]);
    expect(diffJson(undefined, { name: 'Meals' })).toEqual([
      { path: ['name'], kind: 'added', after: 'Meals' },
    ]);
    expect(diffJson({ r: { limit: 1 } }, { r: null })).toEqual([
      { path: ['r', 'limit'], kind: 'removed', before: 1 },
    ]);
  });

  it('compares arrays and type changes as whole values', () => {
    expect(diffJson({ tags: [1] }, { tags: [1, 2] })).toEqual([
      { path: ['tags'], kind: 'changed', before: [1], after: [1, 2] },
    ]);
    expect(diffJson({ v: { a: 1 } }, { v: 'flat' })).toEqual([
      { path: ['v'], kind: 'changed', before: { a: 1 }, after: 'flat' },
    ]);
    expect(diffJson('a', 'b')).toEqual([{ path: [], kind: 'changed', before: 'a', after: 'b' }]);
  });
});
