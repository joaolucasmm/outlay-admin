import type { AuditEventPage, Problem } from 'contracts';
import { can } from '@outlay/domain';
import { delay, http, HttpResponse, type DefaultBodyType } from 'msw';
import { db } from '../db';
import { callerFrom, paginate, problem, unauthenticated } from '../http';

/** Parses an optional ISO date-time query parameter: `undefined` if absent, `null` if invalid. */
const instant = (value: string | null): number | null | undefined => {
  if (value === null || value === '') return undefined;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
};

export const auditHandlers = [
  http.get<never, DefaultBodyType, AuditEventPage | Problem>(
    '*/api/v1/audit-events',
    async ({ request }) => {
      await delay();
      const caller = callerFrom(request, db);
      if (!caller) return unauthenticated();
      if (!can(caller.actor.role, 'audit:read')) return problem(403, 'Forbidden');

      const url = new URL(request.url);
      const params = url.searchParams;
      const requested = params.get('tenantId');
      let tenantId = requested;
      if (caller.actor.role === 'program_admin') {
        if (requested && requested !== caller.tenantId) {
          return problem(403, 'Forbidden', "You can only read your own tenant's audit log.");
        }
        tenantId = caller.tenantId;
      }

      const from = instant(params.get('from'));
      const to = instant(params.get('to'));
      if (from === null || to === null) {
        return problem(422, 'Invalid input', 'Dates must be ISO 8601 date-times.', [
          { field: from === null ? 'from' : 'to', message: 'Not a valid date-time.' },
        ]);
      }
      if (from !== undefined && to !== undefined && from > to) {
        return problem(422, 'Invalid input', 'The start of the range is after its end.', [
          { field: 'from', message: 'Must be before "to".' },
        ]);
      }
      const actorId = params.get('actorId');
      const action = params.get('action');
      const entity = params.get('entity');

      const events = db
        .auditEvents()
        .filter((event) => !tenantId || event.tenantId === tenantId)
        .filter((event) => !actorId || event.actor.id === actorId)
        .filter((event) => !action || event.action === action)
        .filter((event) => !entity || event.entity === entity)
        .filter((event) => {
          const at = Date.parse(event.at);
          return (from === undefined || at >= from) && (to === undefined || at <= to);
        })
        .sort((a, b) => b.at.localeCompare(a.at));

      const page = paginate(events, url);
      if (!page) return problem(400, 'Bad request', 'Invalid cursor.');
      return HttpResponse.json<AuditEventPage>(page);
    },
  ),
];
