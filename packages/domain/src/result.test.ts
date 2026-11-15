import { describe, expect, it } from 'vitest';
import { err, ok, type Result } from './result';

const parsePositive = (n: number): Result<number, 'not_positive'> =>
  n > 0 ? ok(n) : err('not_positive');

describe('Result', () => {
  it('wraps a success value', () => {
    expect(parsePositive(3)).toEqual({ ok: true, value: 3 });
  });

  it('wraps a failure', () => {
    expect(parsePositive(-1)).toEqual({ ok: false, error: 'not_positive' });
  });

  it('narrows on the ok flag', () => {
    const result = parsePositive(5);
    const doubled = result.ok ? result.value * 2 : 0;
    expect(doubled).toBe(10);
  });
});
