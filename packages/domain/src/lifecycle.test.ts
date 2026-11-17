import type { Actor, AdminRole, LifecycleCommand, Tenant, TenantStatus } from 'contracts';
import { describe, expect, it } from 'vitest';
import cases from '../fixtures/lifecycle-cases.json';
import { availableActions, transition } from './lifecycle';
import { can, type Permission } from './permissions';

/**
 * The rules are data in fixtures/lifecycle-cases.json; the Java tenant API runs the very
 * same cases (services/tenant-api), so both implementations stay identical.
 */
interface TransitionCase {
  name: string;
  from: TenantStatus;
  role: AdminRole;
  command: LifecycleCommand;
  expect:
    | { ok: true; to: TenantStatus; event: string; after: Record<string, unknown> }
    | { ok: false; code: string; message: string; field?: string };
}

const NOW = '2026-11-15T12:00:00.000Z';

const tenant = (status: TenantStatus): Tenant => ({
  id: 't1',
  name: cases.tenantName,
  country: 'BR',
  currency: 'BRL',
  status,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const actor = (role: AdminRole): Actor => ({ id: `per_${role}`, role });

describe('availableActions (shared fixture)', () => {
  it.each(Object.entries(cases.availableActions))('%s → %j', (status, actions) => {
    expect(availableActions(status as TenantStatus)).toEqual(actions);
  });
});

describe('permissions (shared fixture)', () => {
  const all = [...new Set(Object.values(cases.permissions).flat())] as Permission[];
  it.each(Object.entries(cases.permissions))('%s', (role, granted) => {
    for (const permission of all) {
      expect(can(role as AdminRole, permission)).toBe(granted.includes(permission));
    }
  });
});

describe('transition (shared fixture)', () => {
  it.each((cases.transitions as TransitionCase[]).map((c) => [c.name, c] as const))(
    '%s',
    (_name, c) => {
      const result = transition(tenant(c.from), c.command, { actor: actor(c.role), now: NOW });

      if (c.expect.ok) {
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.tenant).toMatchObject({ status: c.expect.to, updatedAt: NOW });
        expect(result.value.auditEvent).toEqual({
          tenantId: 't1',
          actor: actor(c.role),
          action: c.expect.event,
          entity: 'tenant',
          entityId: 't1',
          before: { status: c.from },
          after: c.expect.after,
          at: NOW,
        });
      } else {
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe(c.expect.code);
        expect(result.error.message).toBe(c.expect.message);
        if (c.expect.field) expect(result.error).toMatchObject({ field: c.expect.field });
        if (c.expect.code === 'invalid_transition') {
          expect(result.error).toMatchObject({
            from: c.from,
            action: c.command.action,
          });
        }
      }
    },
  );

  it('does not mutate the input tenant', () => {
    const input = tenant('active');
    transition(
      input,
      { action: 'suspend', reason: 'x' },
      { actor: actor('support_operator'), now: NOW },
    );
    expect(input.status).toBe('active');
  });
});
