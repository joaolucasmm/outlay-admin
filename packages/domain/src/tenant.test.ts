import { describe, expect, it } from 'vitest';
import { defaultCurrencyFor, sameTenantName, validateNewTenant } from './tenant';
import { canOnboard, programWriteAccess } from './tenantAccess';

describe('validateNewTenant', () => {
  it('normalises the name', () => {
    expect(validateNewTenant({ name: '  Acme   Rail ', country: 'BR', currency: 'BRL' })).toEqual({
      ok: true,
      value: { name: 'Acme Rail', country: 'BR', currency: 'BRL' },
    });
  });

  it('accepts a currency other than the country default', () => {
    expect(validateNewTenant({ name: 'Acme', country: 'BR', currency: 'USD' }).ok).toBe(true);
  });

  it('reports every invalid field', () => {
    const result = validateNewTenant({ name: 'A', country: 'XX', currency: 'JPY' });
    expect(result.ok ? [] : result.error.map((e) => e.field)).toEqual([
      'name',
      'country',
      'currency',
    ]);
  });

  it('rejects a name over 80 characters', () => {
    expect(validateNewTenant({ name: 'a'.repeat(81), country: 'US', currency: 'USD' }).ok).toBe(
      false,
    );
  });
});

describe('defaultCurrencyFor', () => {
  it('maps a country to its currency', () => {
    expect(defaultCurrencyFor('PT')).toBe('EUR');
    expect(defaultCurrencyFor('XX')).toBeUndefined();
  });
});

describe('sameTenantName', () => {
  it('ignores case and repeated spaces', () => {
    expect(sameTenantName('Bluefin  Logistics', ' bluefin logistics')).toBe(true);
    expect(sameTenantName('Bluefin', 'Bluefin Logistics')).toBe(false);
  });
});

describe('programWriteAccess', () => {
  it.each([
    ['support_operator', 'provisioning', { ok: true, value: true }],
    ['support_operator', 'active', { ok: false, error: 'forbidden' }],
    ['program_admin', 'active', { ok: true, value: true }],
    ['program_admin', 'provisioning', { ok: false, error: 'tenant_not_active' }],
    ['program_admin', 'suspended', { ok: false, error: 'tenant_not_active' }],
  ] as const)('%s on a %s tenant', (role, status, expected) => {
    expect(programWriteAccess(role, { status })).toEqual(expected);
  });

  it('only onboards a provisioning tenant', () => {
    expect(canOnboard({ status: 'provisioning' })).toBe(true);
    expect(canOnboard({ status: 'active' })).toBe(false);
  });
});
