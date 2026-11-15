import { describe, expect, it } from 'vitest';
import { diffJson } from '../../shared/lib/jsonDiff';
import { formatValue, labelPath, presentChanges } from './presentChange';

const ctx = { currency: 'BRL', categoryNames: new Map([['cat_meals', 'Meals']]) };

describe('labelPath', () => {
  it('names policy rule keys and known fields', () => {
    expect(labelPath(['cat_meals:manager', 'limitMinor'], ctx)).toBe('Meals · Manager › Limit');
  });

  it('falls back to the id and to humanized keys', () => {
    expect(labelPath(['cat_unknown:director', 'someNewField'], ctx)).toBe(
      'cat_unknown · Director › Some new field',
    );
    expect(labelPath([], ctx)).toBe('Value');
  });
});

describe('formatValue', () => {
  it.each([
    [40000, ['limitMinor'], 'R$400.00'],
    [0, ['approvalLevels'], 'Auto-approve'],
    [1, ['approvalLevels'], '1 level'],
    [2, ['approvalLevels'], '2 levels'],
    [true, ['active'], 'Yes'],
    [false, ['active'], 'No'],
    [null, ['reason'], '—'],
    [undefined, ['reason'], '—'],
    ['Billing', ['reason'], 'Billing'],
    [7, ['imported'], '7'],
    [[1, 2], ['tags'], '[1,2]'],
  ])('%j at %j → %s', (value, path, expected) => {
    expect(formatValue(value, path, ctx)).toBe(expected);
  });

  it('leaves amounts as numbers when the currency is unknown', () => {
    expect(formatValue(40000, ['limitMinor'], { categoryNames: new Map() })).toBe('40000');
  });
});

describe('presentChanges', () => {
  it('turns a policy diff into readable rows', () => {
    const entries = diffJson(
      { 'cat_meals:manager': { limitMinor: 35000, approvalLevels: 0 } },
      { 'cat_meals:manager': { limitMinor: 40000, approvalLevels: 1 } },
    );
    expect(presentChanges(entries, ctx)).toEqual([
      {
        key: 'cat_meals:manager/approvalLevels',
        label: 'Meals · Manager › Approvals',
        kind: 'changed',
        before: 'Auto-approve',
        after: '1 level',
      },
      {
        key: 'cat_meals:manager/limitMinor',
        label: 'Meals · Manager › Limit',
        kind: 'changed',
        before: 'R$350.00',
        after: 'R$400.00',
      },
    ]);
  });
});
