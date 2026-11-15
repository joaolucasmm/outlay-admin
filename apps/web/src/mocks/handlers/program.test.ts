import type {
  AuditEventPage,
  CategoryPage,
  ExpenseCategory,
  PolicyRuleSet,
  Problem,
} from 'contracts';
import { describe, expect, it } from 'vitest';
import { apiBaseUrl } from '../../app/config';
import { db } from '../db';

const BLUEFIN_ADMIN = 'per_admin_tnt_bluefin';
const HARBOR_ADMIN = 'per_admin_tnt_harbor'; // Harbor is suspended
const OPERATOR = 'per_operator';

const call = async (path: string, persona: string, init: RequestInit = {}) => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Demo-Persona': persona },
  });
  return {
    status: response.status,
    body: (response.status === 204 ? null : await response.json()) as unknown,
  };
};

const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});

const meals = () => db.categories('tnt_bluefin').find((c) => c.code === 'MEALS') as ExpenseCategory;

describe('program endpoints (mock backend)', () => {
  it('lists the tenant categories sorted by code', async () => {
    const { status, body } = await call('/tenants/tnt_bluefin/categories', BLUEFIN_ADMIN);
    expect(status).toBe(200);
    expect((body as CategoryPage).items.map((c) => c.code)).toEqual([
      'CLIENT_ENT',
      'LODGING',
      'MEALS',
      'OFFICE',
      'SOFTWARE',
      'TRAVEL',
    ]);
  });

  it('forbids the Support Operator (403) and hides other tenants (404)', async () => {
    expect((await call('/tenants/tnt_bluefin/categories', OPERATOR)).status).toBe(403);
    expect((await call('/tenants/tnt_kestrel/categories', BLUEFIN_ADMIN)).status).toBe(404);
  });

  it('creates a category and audits it', async () => {
    const { status, body } = await call(
      '/tenants/tnt_bluefin/categories',
      BLUEFIN_ADMIN,
      json('POST', { code: 'TRAINING', name: ' Training ', glAccount: '' }),
    );
    expect(status).toBe(201);
    expect(body).toMatchObject({
      code: 'TRAINING',
      name: 'Training',
      glAccount: null,
      active: true,
    });

    const audit = (await call('/audit-events', BLUEFIN_ADMIN)).body as AuditEventPage;
    expect(audit.items[0]).toMatchObject({ action: 'category.created', entity: 'category' });
  });

  it('rejects a duplicate code (409) and an invalid code (422)', async () => {
    const duplicate = await call(
      '/tenants/tnt_bluefin/categories',
      BLUEFIN_ADMIN,
      json('POST', { code: 'MEALS', name: 'Meals again' }),
    );
    expect(duplicate.status).toBe(409);
    expect((duplicate.body as Problem).errors?.[0]?.field).toBe('code');

    const invalid = await call(
      '/tenants/tnt_bluefin/categories',
      BLUEFIN_ADMIN,
      json('POST', { code: 'meals', name: 'x' }),
    );
    expect(invalid.status).toBe(422);
  });

  it('is read-only while the tenant is not active (409)', async () => {
    const { status, body } = await call(
      '/tenants/tnt_harbor/categories',
      HARBOR_ADMIN,
      json('POST', { code: 'TRAINING', name: 'Training' }),
    );
    expect(status).toBe(409);
    expect((body as Problem).detail).toBe(
      'Harbor Health Group is suspended: its program is read-only.',
    );
    expect((await call('/tenants/tnt_harbor/categories', HARBOR_ADMIN)).status).toBe(200);
  });

  it('updates a category, never its code, and audits only what changed', async () => {
    const id = meals().id;
    const { status, body } = await call(
      `/tenants/tnt_bluefin/categories/${id}`,
      BLUEFIN_ADMIN,
      json('PATCH', { active: false, name: 'Meals' }),
    );
    expect(status).toBe(200);
    expect(body).toMatchObject({ active: false, name: 'Meals' });

    const audit = (await call('/audit-events', BLUEFIN_ADMIN)).body as AuditEventPage;
    expect(audit.items[0]).toMatchObject({
      action: 'category.updated',
      before: { active: true },
      after: { active: false },
    });

    const codeChange = await call(
      `/tenants/tnt_bluefin/categories/${id}`,
      BLUEFIN_ADMIN,
      json('PATCH', { code: 'FOOD' }),
    );
    expect(codeChange.status).toBe(422);
  });

  it('replaces the policy grid and audits the changed rules', async () => {
    const id = meals().id;
    const { status, body } = await call(
      '/tenants/tnt_bluefin/policy-rules',
      BLUEFIN_ADMIN,
      json('PUT', {
        rules: [
          {
            categoryId: id,
            role: 'employee',
            limitMinor: 30000,
            receiptRequiredAboveMinor: 10000,
            approvalLevels: 1,
          },
        ],
      }),
    );
    expect(status).toBe(200);
    expect((body as PolicyRuleSet).items).toHaveLength(1);
    expect(db.policyRules('tnt_bluefin')).toHaveLength(1);

    const audit = (await call('/audit-events', BLUEFIN_ADMIN)).body as AuditEventPage;
    expect(audit.items[0]).toMatchObject({ action: 'policy.updated', entity: 'policy' });
    expect(audit.items[0]?.after).toMatchObject({
      [`${id}:employee`]: { limitMinor: 30000, approvalLevels: 1 },
    });
  });

  it.each([
    [
      'a receipt threshold above the limit',
      { limitMinor: 100, receiptRequiredAboveMinor: 200, approvalLevels: 0 },
      'rules[0].receiptRequiredAboveMinor',
    ],
    [
      'an unknown category',
      { categoryId: 'cat_nope', limitMinor: 100, receiptRequiredAboveMinor: 0, approvalLevels: 0 },
      'rules[0].categoryId',
    ],
  ])('rejects %s (422)', async (_label, overrides, field) => {
    const { status, body } = await call(
      '/tenants/tnt_bluefin/policy-rules',
      BLUEFIN_ADMIN,
      json('PUT', { rules: [{ categoryId: meals().id, role: 'employee', ...overrides }] }),
    );
    expect(status).toBe(422);
    expect((body as Problem).errors?.[0]?.field).toBe(field);
  });

  it('rejects two rules for the same category and role', async () => {
    const rule = {
      categoryId: meals().id,
      role: 'employee',
      limitMinor: 100,
      receiptRequiredAboveMinor: 0,
      approvalLevels: 0,
    };
    const { status } = await call(
      '/tenants/tnt_bluefin/policy-rules',
      BLUEFIN_ADMIN,
      json('PUT', { rules: [rule, rule] }),
    );
    expect(status).toBe(422);
  });
});
