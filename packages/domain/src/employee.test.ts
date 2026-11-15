import { describe, expect, it } from 'vitest';
import { validateEmployeeImport, validateEmployeeRow, type EmployeeRowInput } from './employee';

const row = (overrides: Partial<EmployeeRowInput> = {}): EmployeeRowInput => ({
  name: 'Ana Souza',
  email: 'ana@bluefin.example',
  role: 'manager',
  costCenter: 'OPS',
  ...overrides,
});

describe('validateEmployeeRow', () => {
  it('normalises a valid row', () => {
    expect(
      validateEmployeeRow(
        row({ name: ' Ana Souza ', email: ' Ana@Bluefin.Example ', role: ' Manager ' }),
      ),
    ).toEqual({
      ok: true,
      value: {
        name: 'Ana Souza',
        email: 'ana@bluefin.example',
        role: 'manager',
        costCenter: 'OPS',
      },
    });
  });

  it('reports every invalid field', () => {
    const result = validateEmployeeRow({ name: ' ', email: 'nope', role: 'ceo', costCenter: '' });
    expect(result.ok ? [] : result.error.map((e) => e.field)).toEqual([
      'name',
      'email',
      'role',
      'costCenter',
    ]);
  });

  it.each([
    ['name', { name: 'a'.repeat(101) }],
    ['email', { email: `${'a'.repeat(250)}@b.co` }],
    ['email', { email: 'a b@c.com' }],
    ['costCenter', { costCenter: 'x'.repeat(41) }],
  ] as const)('rejects a too long or malformed %s', (field, overrides) => {
    expect(validateEmployeeRow(row(overrides))).toMatchObject({ ok: false, error: [{ field }] });
  });
});

describe('validateEmployeeImport', () => {
  it('splits valid and invalid rows, keeping their positions', () => {
    const result = validateEmployeeImport(
      [row(), row({ email: 'bad' }), row({ email: 'bo@bluefin.example' })],
      [],
    );
    expect(result.valid.map((v) => v.index)).toEqual([0, 2]);
    expect(result.invalid).toMatchObject([{ index: 1, errors: [{ field: 'email' }] }]);
  });

  it('flags emails the tenant already has, ignoring case', () => {
    const result = validateEmployeeImport([row()], ['ANA@bluefin.example']);
    expect(result.invalid[0]?.errors).toEqual([
      { field: 'email', message: 'An employee with this email already exists.' },
    ]);
  });

  it('flags every copy of an email repeated in the file', () => {
    const result = validateEmployeeImport(
      [row(), row({ name: 'Ana S.', email: 'ANA@bluefin.example' })],
      [],
    );
    expect(result.valid).toEqual([]);
    expect(result.invalid.map((i) => i.errors[0]?.message)).toEqual([
      'This email appears more than once in the file.',
      'This email appears more than once in the file.',
    ]);
  });

  it('accepts an empty file', () => {
    expect(validateEmployeeImport([], [])).toEqual({ valid: [], invalid: [] });
  });
});
