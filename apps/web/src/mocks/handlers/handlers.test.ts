import type { AuditEventPage, Problem, TenantPage } from 'contracts';
import { describe, expect, it } from 'vitest';
import { apiBaseUrl } from '../../app/config';
import { db } from '../db';

const ADMIN = 'per_admin_tnt_bluefin';
const OPERATOR = 'per_operator';

const call = async (path: string, persona?: string, init: RequestInit = {}) => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(persona ? { 'X-Demo-Persona': persona } : {}),
    },
  });
  return { status: response.status, body: (await response.json()) as unknown };
};

const transitionAs = (persona: string, tenantId: string, command: object) =>
  call(`/tenants/${tenantId}/transitions`, persona, {
    method: 'POST',
    body: JSON.stringify(command),
  });

describe('mock backend', () => {
  it('rejects requests without a persona (401)', async () => {
    expect((await call('/tenants')).status).toBe(401);
  });

  it('scopes the tenant list to a Program Admin’s own tenant', async () => {
    const body = (await call('/tenants', ADMIN)).body as TenantPage;
    expect(body.items.map((t) => t.id)).toEqual(['tnt_bluefin']);
  });

  it('returns 403 when a Program Admin runs a lifecycle action', async () => {
    const { status, body } = await transitionAs(ADMIN, 'tnt_bluefin', {
      action: 'suspend',
      reason: 'x',
    });
    expect(status).toBe(403);
    expect(body).toMatchObject({ title: 'Forbidden' });
    expect(db.findTenant('tnt_bluefin')?.status).toBe('active');
  });

  it('returns 409 for a transition the status does not allow', async () => {
    const { status } = await transitionAs(OPERATOR, 'tnt_bluefin', { action: 'activate' });
    expect(status).toBe(409);
  });

  it('returns 422 with the offending field', async () => {
    const { status, body } = await transitionAs(OPERATOR, 'tnt_bluefin', { action: 'suspend' });
    expect(status).toBe(422);
    expect((body as Problem).errors).toEqual([
      { field: 'reason', message: 'A reason is required to suspend a tenant.' },
    ]);
  });

  it('applies a valid transition and emits an audit event', async () => {
    const { status, body } = await transitionAs(OPERATOR, 'tnt_tidewater', { action: 'activate' });
    expect(status).toBe(200);
    expect(body).toMatchObject({ id: 'tnt_tidewater', status: 'active' });

    const audit = (await call('/audit-events?tenantId=tnt_tidewater', OPERATOR))
      .body as AuditEventPage;
    expect(audit.items[0]).toMatchObject({
      action: 'tenant.activated',
      actor: { id: OPERATOR, role: 'support_operator' },
      before: { status: 'provisioning' },
      after: { status: 'active' },
    });
  });

  it("forbids a Program Admin from reading another tenant's audit log", async () => {
    expect((await call('/audit-events?tenantId=tnt_harbor', ADMIN)).status).toBe(403);
  });

  it('paginates with an opaque cursor', async () => {
    const first = (await call('/tenants?limit=3', OPERATOR)).body as TenantPage;
    expect(first.items).toHaveLength(3);
    const second = (await call(`/tenants?limit=3&cursor=${first.nextCursor ?? ''}`, OPERATOR))
      .body as TenantPage;
    expect(second.items[0]?.name).toBe('Kestrel Robotics');
  });
});
