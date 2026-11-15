import type { AuditEventPage } from 'contracts';
import { describe, expect, it } from 'vitest';
import { apiBaseUrl } from '../../app/config';

const OPERATOR = 'per_operator';
const BLUEFIN_ADMIN = 'per_admin_tnt_bluefin';

const list = async (query: string, persona = OPERATOR) => {
  const response = await fetch(`${apiBaseUrl}/audit-events?${query}`, {
    headers: { 'X-Demo-Persona': persona },
  });
  return { status: response.status, body: (await response.json()) as AuditEventPage };
};

const actions = (page: AuditEventPage) => page.items.map((e) => e.action);

describe('GET /audit-events filters (mock backend)', () => {
  it('lists a tenant’s events newest first', async () => {
    const { body } = await list('tenantId=tnt_bluefin');
    expect(actions(body)).toEqual([
      'policy.updated',
      'category.updated',
      'tenant.activated',
      'tenant.created',
    ]);
  });

  it.each([
    ['actorId=per_admin_tnt_bluefin', ['policy.updated', 'category.updated']],
    ['action=tenant.activated', ['tenant.activated']],
    ['entity=category', ['category.updated']],
    ['from=2026-03-01T00:00:00Z&to=2026-03-31T23:59:59Z', ['policy.updated', 'category.updated']],
    ['to=2026-02-03T14:12:00.000Z', ['tenant.created']],
    ['actorId=per_operator&entity=policy', []],
  ])('filters by %s', async (query, expected) => {
    const { body } = await list(`tenantId=tnt_bluefin&${query}`);
    expect(actions(body)).toEqual(expected);
  });

  it('keeps a Program Admin inside their tenant, filters included', async () => {
    const { body } = await list('action=tenant.suspended', BLUEFIN_ADMIN);
    expect(body.items).toEqual([]);
  });

  it.each([
    ['from=yesterday', 'from'],
    ['to=2026-13-45', 'to'],
    ['from=2026-04-01T00:00:00Z&to=2026-03-01T00:00:00Z', 'from'],
  ])('rejects %s with 422', async (query, field) => {
    const response = await fetch(`${apiBaseUrl}/audit-events?${query}`, {
      headers: { 'X-Demo-Persona': OPERATOR },
    });
    expect(response.status).toBe(422);
    const body = (await response.json()) as { errors: { field: string }[] };
    expect(body.errors[0]?.field).toBe(field);
  });
});
