import { formatDateTime } from '../../../shared/lib/dates';
import { useGetTenantsInfiniteQuery } from '../../tenants/api';
import { useGetAuditEventsQuery } from '../api';
import { actionLabel } from '../labels';
import { reasonOf } from '../summary';

/** The last few audit events across all tenants, next to the tenants table. */
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
                  <span className="font-medium">
                    {names.get(event.tenantId ?? event.entityId) ?? event.entityId}
                  </span>{' '}
                  · {actionLabel(event.action)}
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
