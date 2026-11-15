import type { EmployeePage, Problem, Tenant, TemplateResult } from 'contracts';
import { describe, expect, it } from 'vitest';
import { apiBaseUrl } from '../../app/config';
import { db } from '../db';

const OPERATOR = 'per_operator';
const BLUEFIN_ADMIN = 'per_admin_tnt_bluefin';
const HARBOR_ADMIN = 'per_admin_tnt_harbor'; // suspended

const call = async (path: string, persona: string, body?: unknown) => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Demo-Persona': persona },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: (await response.json()) as unknown };
};

const employee = (email: string) => ({
  name: 'New Person',
  email,
  role: 'employee',
  costCenter: 'OPS',
});

describe('onboarding endpoints (mock backend)', () => {
  it('creates a tenant in provisioning and audits it', async () => {
    const { status, body } = await call('/tenants', OPERATOR, {
      name: ' Acme  Rail ',
      country: 'PT',
      currency: 'EUR',
    });
    expect(status).toBe(201);
    expect(body).toMatchObject({ name: 'Acme Rail', status: 'provisioning', currency: 'EUR' });
    expect(db.auditEvents()[0]).toMatchObject({ action: 'tenant.created' });
  });

  it('rejects creating a tenant as a Program Admin, a duplicate name or bad input', async () => {
    const input = { name: 'Acme', country: 'US', currency: 'USD' };
    expect((await call('/tenants', BLUEFIN_ADMIN, input)).status).toBe(403);
    const duplicate = await call('/tenants', OPERATOR, { ...input, name: 'bluefin  LOGISTICS' });
    expect(duplicate.status).toBe(409);
    expect((duplicate.body as Problem).errors?.[0]?.field).toBe('name');
    expect((await call('/tenants', OPERATOR, { ...input, country: 'XX' })).status).toBe(422);
  });

  it('applies the standard template once, then skips existing codes', async () => {
    const path = '/tenants/tnt_tidewater/program:apply-template';
    const first = await call(path, OPERATOR, { templateId: 'standard' });
    expect(first).toEqual({ status: 200, body: { categoriesCreated: 6, rulesCreated: 16 } });
    expect(db.categories('tnt_tidewater')).toHaveLength(6);

    const again = await call(path, OPERATOR, { templateId: 'standard' });
    expect((again.body as TemplateResult).categoriesCreated).toBe(0);
  });

  it('only applies a template while onboarding, as the operator', async () => {
    const path = '/tenants/tnt_bluefin/program:apply-template';
    expect((await call(path, OPERATOR, { templateId: 'standard' })).status).toBe(409);
    expect((await call(path, BLUEFIN_ADMIN, { templateId: 'standard' })).status).toBe(403);
  });

  it('lets the operator import while provisioning, and a Program Admin while active', async () => {
    const operator = await call('/tenants/tnt_tidewater/employees:import', OPERATOR, {
      employees: [employee('a@tidewater.example'), employee('b@tidewater.example')],
    });
    expect(operator).toEqual({ status: 200, body: { imported: 2 } });

    const admin = await call('/tenants/tnt_bluefin/employees:import', BLUEFIN_ADMIN, {
      employees: [employee('NEW@bluefin.example')],
    });
    expect(admin.status).toBe(200);
    expect(db.employees('tnt_bluefin').some((e) => e.email === 'new@bluefin.example')).toBe(true);
  });

  it.each([
    ['the operator on an active tenant', OPERATOR, 'tnt_bluefin', 403],
    ['an admin of a suspended tenant', HARBOR_ADMIN, 'tnt_harbor', 409],
    ['an admin of another tenant', BLUEFIN_ADMIN, 'tnt_kestrel', 404],
  ])('refuses an import by %s', async (_label, persona, tenantId, status) => {
    const result = await call(`/tenants/${tenantId}/employees:import`, persona, {
      employees: [employee('x@y.example')],
    });
    expect(result.status).toBe(status);
  });

  it('imports all or nothing, pointing at the bad rows', async () => {
    const before = db.employees('tnt_bluefin').length;
    const { status, body } = await call('/tenants/tnt_bluefin/employees:import', BLUEFIN_ADMIN, {
      employees: [employee('fresh@bluefin.example'), employee('Ana.Souza@bluefin.example')],
    });
    expect(status).toBe(422);
    expect((body as Problem).errors).toEqual([
      { field: 'employees[1].email', message: 'An employee with this email already exists.' },
    ]);
    expect(db.employees('tnt_bluefin')).toHaveLength(before);
  });

  it('lists employees by name with search and role filters', async () => {
    const all = (await call('/tenants/tnt_bluefin/employees?limit=100', BLUEFIN_ADMIN))
      .body as EmployeePage;
    expect(all.items).toHaveLength(14);
    expect(all.items.map((e) => e.name)).toEqual([...all.items.map((e) => e.name)].sort());

    const directors = (await call('/tenants/tnt_bluefin/employees?role=director', BLUEFIN_ADMIN))
      .body as EmployeePage;
    expect(directors.items.every((e) => e.role === 'director')).toBe(true);

    const search = (await call('/tenants/tnt_bluefin/employees?q=ana.souza', BLUEFIN_ADMIN))
      .body as EmployeePage;
    expect(search.items.map((e) => e.email)).toEqual(['ana.souza@bluefin.example']);
  });

  it('keeps the created tenant listed for the operator', async () => {
    await call('/tenants', OPERATOR, { name: 'Zeta Labs', country: 'US', currency: 'USD' });
    expect(db.tenants().some((t: Tenant) => t.name === 'Zeta Labs')).toBe(true);
  });
});
