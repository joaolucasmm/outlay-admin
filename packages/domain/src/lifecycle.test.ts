import type { Actor, LifecycleAction, Tenant, TenantStatus } from 'contracts';
import { describe, expect, it } from 'vitest';
import { availableActions, transition } from './lifecycle';

const NOW = '2026-11-15T12:00:00.000Z';
const operator: Actor = { id: 'per_operator', role: 'support_operator' };
const admin: Actor = { id: 'per_admin_t1', role: 'program_admin' };

const tenant = (status: TenantStatus): Tenant => ({
  id: 't1',
  name: 'Bluefin Logistics',
  country: 'BR',
  currency: 'BRL',
  status,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const run = (status: TenantStatus, action: LifecycleAction, extra = {}, actor = operator) =>
  transition(tenant(status), { action, ...extra }, { actor, now: NOW });

describe('availableActions', () => {
  it.each([
    ['provisioning', ['activate']],
    ['active', ['suspend']],
    ['suspended', ['reactivate', 'deprovision']],
    ['deprovisioned', []],
  ] as const)('%s → %j', (status, actions) => {
    expect(availableActions(status)).toEqual(actions);
  });
});

describe('transition', () => {
  it.each([
    ['provisioning', 'activate', {}, 'active', 'tenant.activated'],
    ['active', 'suspend', { reason: 'Unpaid invoices' }, 'suspended', 'tenant.suspended'],
    ['suspended', 'reactivate', {}, 'active', 'tenant.reactivated'],
    [
      'suspended',
      'deprovision',
      { confirmationName: 'Bluefin Logistics' },
      'deprovisioned',
      'tenant.deprovisioned',
    ],
  ] as const)('%s --%s--> %s', (from, action, extra, to, event) => {
    const result = run(from, action, extra);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tenant).toMatchObject({ status: to, updatedAt: NOW });
    expect(result.value.auditEvent).toMatchObject({
      tenantId: 't1',
      entity: 'tenant',
      entityId: 't1',
      action: event,
      actor: operator,
      before: { status: from },
      at: NOW,
    });
  });

  it('records the trimmed suspend reason in the audit event', () => {
    const result = run('active', 'suspend', { reason: '  Unpaid invoices ' });
    expect(result.ok && result.value.auditEvent.after).toEqual({
      status: 'suspended',
      reason: 'Unpaid invoices',
    });
  });

  it('does not mutate the input tenant', () => {
    const input = tenant('active');
    transition(input, { action: 'suspend', reason: 'x' }, { actor: operator, now: NOW });
    expect(input.status).toBe('active');
  });

  it('forbids a Program Admin, before anything else', () => {
    const result = run('deprovisioned', 'activate', {}, admin);
    expect(result).toMatchObject({ ok: false, error: { code: 'forbidden' } });
  });

  it.each([
    ['provisioning', 'suspend'],
    ['active', 'activate'],
    ['active', 'deprovision'],
    ['suspended', 'suspend'],
    ['deprovisioned', 'reactivate'],
  ] as const)('rejects %s --%s--> as an invalid transition', (from, action) => {
    const result = run(from, action, { reason: 'r', confirmationName: 'Bluefin Logistics' });
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'invalid_transition', from, action },
    });
  });

  it.each([{}, { reason: '' }, { reason: '   ' }])('requires a suspend reason (%j)', (extra) => {
    expect(run('active', 'suspend', extra)).toMatchObject({
      ok: false,
      error: { code: 'reason_required', field: 'reason' },
    });
  });

  it.each([{}, { confirmationName: 'bluefin logistics' }, { confirmationName: 'Bluefin' }])(
    'requires the exact tenant name to deprovision (%j)',
    (extra) => {
      expect(run('suspended', 'deprovision', extra)).toMatchObject({
        ok: false,
        error: { code: 'name_mismatch', field: 'confirmationName' },
      });
    },
  );

  it('accepts the confirmation name with surrounding spaces', () => {
    expect(run('suspended', 'deprovision', { confirmationName: ' Bluefin Logistics ' }).ok).toBe(
      true,
    );
  });
});
