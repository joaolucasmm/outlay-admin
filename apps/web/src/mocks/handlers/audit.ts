import type { AuditEventPage, Problem } from 'contracts';
import { can } from '@outlay/domain';
import { delay, http, HttpResponse, type DefaultBodyType } from 'msw';
import { db } from '../db';
import { callerFrom, paginate, problem, unauthenticated } from '../http';

export const auditHandlers = [
  http.get<never, DefaultBodyType, AuditEventPage | Problem>(
    '*/api/v1/audit-events',
    async ({ request }) => {
      await delay();
      const caller = callerFrom(request, db);
      if (!caller) return unauthenticated();
      if (!can(caller.actor.role, 'audit:read')) return problem(403, 'Forbidden');

      const url = new URL(request.url);
      const requested = url.searchParams.get('tenantId');
      let tenantId = requested;
      if (caller.actor.role === 'program_admin') {
        if (requested && requested !== caller.tenantId) {
          return problem(403, 'Forbidden', "You can only read your own tenant's audit log.");
        }
        tenantId = caller.tenantId;
      }

      const events = db
        .auditEvents()
        .filter((event) => !tenantId || event.tenantId === tenantId)
        .sort((a, b) => b.at.localeCompare(a.at));

      const page = paginate(events, url);
      if (!page) return problem(400, 'Bad request', 'Invalid cursor.');
      return HttpResponse.json<AuditEventPage>(page);
    },
  ),
];
