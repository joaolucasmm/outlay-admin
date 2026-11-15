import { describe, expect, it } from 'vitest';
import { errorReportCsv, MAX_ROWS, parseEmployeeCsv, TEMPLATE_CSV } from './csv';

const parse = (text: string, existing: string[] = []) =>
  parseEmployeeCsv(text, 'team.csv', existing);

describe('parseEmployeeCsv', () => {
  it('parses the template', () => {
    const result = parse(TEMPLATE_CSV);
    expect(result.ok && result.value.valid.map((v) => v.employee.email)).toEqual([
      'ana.souza@example.com',
      'bruno.lima@example.com',
      'carla.costa@example.com',
    ]);
  });

  it('accepts semicolons, a BOM, header variants and blank lines', () => {
    const text = '﻿Name; EMAIL ;Role;Cost Center\r\n\r\nAna;ana@x.example;Manager;OPS\r\n;;;\r\n';
    const result = parse(text);
    expect(result).toMatchObject({
      ok: true,
      value: {
        valid: [
          {
            line: 3,
            employee: { name: 'Ana', email: 'ana@x.example', role: 'manager', costCenter: 'OPS' },
          },
        ],
        invalid: [],
      },
    });
  });

  it('reports row errors with the file line number', () => {
    const text =
      'name,email,role,costCenter\nAna,ana@x.example,manager,OPS\nBo,not-an-email,ceo,OPS\n';
    const result = parse(text);
    expect(result.ok && result.value.invalid).toEqual([
      {
        line: 3,
        row: { name: 'Bo', email: 'not-an-email', role: 'ceo', costCenter: 'OPS' },
        errors: ['Enter a valid email address.', 'Role must be employee, manager or director.'],
      },
    ]);
  });

  it('flags emails the tenant already has', () => {
    const result = parse('name,email,role,costCenter\nAna,ANA@x.example,employee,OPS', [
      'ana@x.example',
    ]);
    expect(result.ok && result.value.invalid[0]?.errors).toEqual([
      'An employee with this email already exists.',
    ]);
  });

  it.each([
    ['name,email\nAna,a@x.example', 'Missing columns: role, costCenter.'],
    ['name,email,role,costCenter\n', 'The file has no employee rows.'],
    [
      `name,email,role,costCenter\n${'A,a@x.example,employee,OPS\n'.repeat(MAX_ROWS + 1)}`,
      `The file has ${MAX_ROWS + 1} rows; the limit is ${MAX_ROWS}.`,
    ],
  ])('rejects a bad file (%#)', (text, message) => {
    const result = parse(text);
    expect(result.ok ? '' : result.error).toContain(message);
  });
});

describe('errorReportCsv', () => {
  it('lists the failing rows with their problems', () => {
    expect(
      errorReportCsv([
        {
          line: 3,
          row: { name: 'Bo', email: 'bad', role: 'ceo', costCenter: 'OPS' },
          errors: ['Bad email.', 'Bad role.'],
        },
      ]),
    ).toBe('line,name,email,role,costCenter,errors\r\n3,Bo,bad,ceo,OPS,Bad email.; Bad role.');
  });
});
