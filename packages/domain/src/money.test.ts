import { describe, expect, it } from 'vitest';
import { fromMinor, toMinor } from './money';

describe('toMinor', () => {
  it.each([
    ['150', 2, 15000],
    ['150.5', 2, 15050],
    ['150.50', 2, 15050],
    [' 0.07 ', 2, 7],
    ['0', 2, 0],
    ['1500', 0, 1500],
    ['1.234', 3, 1234],
  ])('%j with %i decimals → %i', (input, digits, expected) => {
    expect(toMinor(input, digits)).toEqual({ ok: true, value: expected });
  });

  it.each(['', 'abc', '-5', '1,50', '1.', '.5', '1e3'])('rejects %j', (input) => {
    expect(toMinor(input, 2)).toMatchObject({ ok: false, error: { code: 'invalid_amount' } });
  });

  it('rejects more decimals than the currency has', () => {
    expect(toMinor('12.345', 2)).toMatchObject({
      ok: false,
      error: { code: 'too_many_decimals', message: 'Use at most 2 decimals.' },
    });
    expect(toMinor('12.5', 0)).toMatchObject({
      ok: false,
      error: { code: 'too_many_decimals', message: 'This currency has no decimals.' },
    });
  });

  it('rejects amounts beyond a safe integer', () => {
    expect(toMinor('99999999999999999', 2)).toMatchObject({
      ok: false,
      error: { code: 'too_large' },
    });
  });
});

describe('fromMinor', () => {
  it.each([
    [15000, 2, '150.00'],
    [7, 2, '0.07'],
    [0, 2, '0.00'],
    [1500, 0, '1500'],
  ])('%i with %i decimals → %j', (minor, digits, expected) => {
    expect(fromMinor(minor, digits)).toBe(expected);
  });

  it('round-trips with toMinor', () => {
    expect(toMinor(fromMinor(123456, 2), 2)).toEqual({ ok: true, value: 123456 });
  });
});
