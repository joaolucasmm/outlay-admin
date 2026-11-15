import { describe, expect, it } from 'vitest';
import { validateCategoryFields } from './category';
import { canEditProgram } from './tenantAccess';

describe('validateCategoryFields', () => {
  it('normalises valid fields', () => {
    expect(
      validateCategoryFields({ code: ' MEALS ', name: ' Meals ', glAccount: ' 6100 ' }),
    ).toEqual({ ok: true, value: { code: 'MEALS', name: 'Meals', glAccount: '6100' } });
  });

  it('turns an empty or null GL account into null', () => {
    expect(validateCategoryFields({ glAccount: '  ' })).toEqual({
      ok: true,
      value: { glAccount: null },
    });
    expect(validateCategoryFields({ glAccount: null })).toEqual({
      ok: true,
      value: { glAccount: null },
    });
  });

  it('only checks the fields that are present', () => {
    expect(validateCategoryFields({})).toEqual({ ok: true, value: {} });
  });

  it.each(['meals', 'M', '1MEALS', 'MEALS-2', 'A'.repeat(21)])('rejects code %j', (code) => {
    expect(validateCategoryFields({ code })).toMatchObject({
      ok: false,
      error: [{ field: 'code' }],
    });
  });

  it('reports every invalid field', () => {
    const result = validateCategoryFields({ code: 'x', name: ' ', glAccount: '1'.repeat(21) });
    expect(result.ok ? [] : result.error.map((e) => e.field)).toEqual([
      'code',
      'name',
      'glAccount',
    ]);
  });

  it('rejects a name over 60 characters', () => {
    expect(validateCategoryFields({ name: 'a'.repeat(61) }).ok).toBe(false);
  });
});

describe('canEditProgram', () => {
  it.each([
    ['active', true],
    ['provisioning', false],
    ['suspended', false],
    ['deprovisioned', false],
  ] as const)('%s → %s', (status, expected) => {
    expect(canEditProgram({ status })).toBe(expected);
  });
});
