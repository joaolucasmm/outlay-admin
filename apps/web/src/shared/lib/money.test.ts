import { describe, expect, it } from 'vitest';
import { formatMoney, fractionDigitsFor } from './money';

describe('money formatting', () => {
  it('uses each currency’s own decimals', () => {
    expect(fractionDigitsFor('BRL')).toBe(2);
    expect(fractionDigitsFor('JPY')).toBe(0);
  });

  it('formats minor units in the given currency', () => {
    expect(formatMoney(15050, 'BRL')).toBe('R$150.50');
    expect(formatMoney(15050, 'USD')).toBe('$150.50');
    expect(formatMoney(1500, 'JPY')).toBe('¥1,500');
  });
});
