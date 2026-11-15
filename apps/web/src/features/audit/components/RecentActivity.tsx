import type { AuditEvent } from 'contracts';
import { formatDateTime } from '../../../shared/lib/dates';
import { useGetTenantsInfiniteQuery } from '../../tenants/api';
import { useGetAuditEventsQuery } from '../api';

const ACTION_LABELS: Record<string, string> = {
  'tenant.activated': 'Activated',
  'tenant.suspended': 'Suspended',
  'tenant.reactivated': 'Reactivated',
  'tenant.deprovisioned': 'Deprovisioned',
  'tenant.created': 'Created',
  'program.template_applied': 'Template applied to',
  'employees.imported': 'Employees imported to',
  'category.created': 'Category created in',
  'category.updated': 'Category updated in',
  'policy.updated': 'Policy updated in',
};

const reasonOf = (event: AuditEvent): string | null => {
  const after = event.after;
  return typeof after === 'object' &&
    after !== null &&
    'reason' in after &&
    typeof after.reason === 'string'
    ? after.reason
    : null;
};

/** The last few audit events, so the audit trail is visible before the M4 audit page. */
export function RecentActivity() {
  const { data, isLoading, isError } = useGetAuditEventsQuery({ limit: 5 });
  const { data: tenants } = useGetTenantsInfiniteQuery({ limit: 100 });
  const names = new Map(
    tenants?.pages.flatMap((page) => page.items).map((tenant) => [tenant.id, tenant.name]) ?? [],
  );

  return (
    <section
      aria-labelledby="recent-activity"
      className="rounded-lg border border-slate-200 bg-white p-4"
    >
      <h2 id="recent-activity" className="text-sm font-semibold text-slate-900">
        Recent activity
      </h2>
      {isLoading ? (
        <p className="mt-3 text-sm text-slate-500">Loading activity…</p>
      ) : isError || !data ? (
        <p className="mt-3 text-sm text-red-700">Could not load activity.</p>
      ) : data.items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No activity yet.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {data.items.map((event) => {
            const reason = reasonOf(event);
            return (
              <li key={event.id} className="text-sm">
                <p>
                  <span className="font-medium">{ACTION_LABELS[event.action] ?? event.action}</span>{' '}
                  {names.get(event.tenantId ?? event.entityId) ?? event.entityId}
                </p>
                {reason && <p className="text-slate-600">Reason: {reason}</p>}
                <p className="text-xs text-slate-500">
                  <time dateTime={event.at}>{formatDateTime(event.at)}</time>
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
