import { describe, expect, it } from 'vitest';
import { can } from './permissions';

describe('can', () => {
  it.each([
    ['tenants:list', true, false],
    ['tenants:create', true, false],
    ['tenants:transition', true, false],
    ['tenant:configure', false, true],
    ['audit:read', true, true],
  ] as const)('%s → operator %s, program admin %s', (permission, operator, admin) => {
    expect(can('support_operator', permission)).toBe(operator);
    expect(can('program_admin', permission)).toBe(admin);
  });
});
