import type { LifecycleCommand, Problem, Tenant, TenantPage, TenantStatus } from 'contracts';
import { transition, type TransitionError } from '@outlay/domain';
import { delay, http, HttpResponse, type DefaultBodyType } from 'msw';
import { db } from '../db';
import { callerFrom, paginate, problem, unauthenticated } from '../http';

const STATUSES: readonly TenantStatus[] = ['provisioning', 'active', 'suspended', 'deprovisioned'];
const ACTIONS: readonly string[] = ['activate', 'suspend', 'reactivate', 'deprovision'];

const isCommand = (body: unknown): body is LifecycleCommand =>
  typeof body === 'object' &&
  body !== null &&
  'action' in body &&
  typeof body.action === 'string' &&
  ACTIONS.includes(body.action);

const toProblem = (error: TransitionError) => {
  switch (error.code) {
    case 'forbidden':
      return problem(403, 'Forbidden', error.message);
    case 'invalid_transition':
      return problem(409, 'Invalid transition', error.message);
    case 'reason_required':
    case 'name_mismatch':
      return problem(422, 'Invalid command', error.message, [
        { field: error.field, message: error.message },
      ]);
  }
};

export const tenantHandlers = [
  http.get<never, DefaultBodyType, TenantPage | Problem>(
    '*/api/v1/tenants',
    async ({ request }) => {
      await delay();
      const caller = callerFrom(request, db);
      if (!caller) return unauthenticated();

      const url = new URL(request.url);
      const q = url.searchParams.get('q')?.trim().toLowerCase() ?? '';
      const status = url.searchParams.get('status');
      if (status && !STATUSES.includes(status as TenantStatus)) {
        return problem(400, 'Bad request', `Unknown status "${status}".`);
      }

      const visible = db
        .tenants()
        // A Program Admin only ever sees their own tenant.
        .filter((t) => caller.actor.role === 'support_operator' || t.id === caller.tenantId)
        .filter((t) => !q || t.name.toLowerCase().includes(q))
        .filter((t) => !status || t.status === status)
        .sort((a, b) => a.name.localeCompare(b.name));

      const page = paginate(visible, url);
      if (!page) return problem(400, 'Bad request', 'Invalid cursor.');
      return HttpResponse.json<TenantPage>(page);
    },
  ),

  http.get<{ tenantId: string }, DefaultBodyType, Tenant | Problem>(
    '*/api/v1/tenants/:tenantId',
    async ({ request, params }) => {
      await delay();
      const caller = callerFrom(request, db);
      if (!caller) return unauthenticated();
      const tenant = db.findTenant(params.tenantId);
      const visible =
        tenant && (caller.actor.role === 'support_operator' || tenant.id === caller.tenantId);
      if (!visible) return problem(404, 'Not found', 'Tenant not found.');
      return HttpResponse.json<Tenant>(tenant);
    },
  ),

  http.post<{ tenantId: string }, DefaultBodyType, Tenant | Problem>(
    '*/api/v1/tenants/:tenantId/transitions',
    async ({ request, params }) => {
      await delay();
      const caller = callerFrom(request, db);
      if (!caller) return unauthenticated();
      const tenant = db.findTenant(params.tenantId);
      if (!tenant) return problem(404, 'Not found', 'Tenant not found.');

      const body: unknown = await request.json().catch(() => null);
      if (!isCommand(body)) {
        return problem(422, 'Invalid command', 'Body must be a LifecycleCommand.', [
          { field: 'action', message: 'Unknown or missing action.' },
        ]);
      }

      const result = transition(tenant, body, {
        actor: caller.actor,
        now: new Date().toISOString(),
      });
      if (!result.ok) return toProblem(result.error);

      db.updateTenant(result.value.tenant);
      db.addAuditEvent({ id: `aud_${crypto.randomUUID()}`, ...result.value.auditEvent });
      return HttpResponse.json<Tenant>(result.value.tenant);
    },
  ),
];
