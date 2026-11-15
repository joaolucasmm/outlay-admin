import { availableActions } from '@outlay/domain';
import type { ColumnDef } from '@tanstack/react-table';
import type { LifecycleAction, Tenant, TenantStatus } from 'contracts';
import { useId, useState } from 'react';
import { Link } from 'react-router';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';
import { formatDate } from '../../../shared/lib/dates';
import { Button } from '../../../shared/ui/Button';
import { DataTable } from '../../../shared/ui/DataTable';
import { Select } from '../../../shared/ui/Select';
import { RecentActivity } from '../../audit/components/RecentActivity';
import { useGetTenantsInfiniteQuery } from '../api';
import { ACTION_LABELS, LifecycleDialog } from '../components/LifecycleDialog';
import { STATUS_LABELS, TenantStatusBadge } from '../components/TenantStatusBadge';

export const PAGE_SIZE = 5;

type StatusFilter = TenantStatus | 'all';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  ...(Object.keys(STATUS_LABELS) as TenantStatus[]).map((status) => ({
    value: status,
    label: STATUS_LABELS[status],
  })),
];

interface PendingAction {
  tenant: Tenant;
  action: LifecycleAction;
}

export function TenantsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [notice, setNotice] = useState('');
  const searchId = useId();
  const q = useDebouncedValue(search.trim());

  const { data, isLoading, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useGetTenantsInfiniteQuery({
      q: q || undefined,
      status: status === 'all' ? undefined : status,
      limit: PAGE_SIZE,
    });
  const tenants = data?.pages.flatMap((page) => page.items) ?? [];
  const filtered = q !== '' || status !== 'all';

  const columns: ColumnDef<Tenant>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    { id: 'country', header: 'Country', cell: ({ row }) => row.original.country },
    { id: 'currency', header: 'Currency', cell: ({ row }) => row.original.currency },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <TenantStatusBadge status={row.original.status} />,
    },
    {
      id: 'updatedAt',
      header: 'Updated',
      cell: ({ row }) => (
        <time dateTime={row.original.updatedAt}>{formatDate(row.original.updatedAt)}</time>
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          {availableActions(row.original.status).map((action) => (
            <Button
              key={action}
              size="sm"
              variant={action === 'deprovision' ? 'danger' : 'secondary'}
              onClick={() => {
                setNotice('');
                setPending({ tenant: row.original, action });
              }}
            >
              {ACTION_LABELS[action]}
              <span className="sr-only"> {row.original.name}</span>
            </Button>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tenants</h1>
          <p className="mt-1 text-sm text-slate-600">
            Every customer company on the platform and where it is in its lifecycle.
          </p>
        </div>
        <Link
          to="/tenants/new"
          className="inline-flex items-center rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white outline-none hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
        >
          New tenant
        </Link>
      </div>

      <p
        role="status"
        className={
          notice ? 'rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800' : 'sr-only'
        }
      >
        {notice}
      </p>

      <div className="grid gap-6 xl:grid-cols-[1fr_18rem]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <label htmlFor={searchId} className="text-slate-600">
                Search tenants
              </label>
              <input
                id={searchId}
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                }}
                placeholder="Name contains…"
                className="rounded-md border border-slate-300 px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              />
            </div>
            <Select label="Status" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
          </div>

          {isLoading ? (
            <p role="status" className="text-sm text-slate-600">
              Loading tenants…
            </p>
          ) : isError ? (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              <p>Could not load tenants.</p>
              <Button className="mt-3" onClick={() => void refetch()}>
                Retry
              </Button>
            </div>
          ) : tenants.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm">
              <p className="font-medium">
                {filtered ? 'No tenants match your filters.' : 'No tenants yet.'}
              </p>
              {filtered && (
                <Button
                  className="mt-3"
                  onClick={() => {
                    setSearch('');
                    setStatus('all');
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <DataTable
                caption="Tenants"
                data={tenants}
                columns={columns}
                getRowId={(t) => t.id}
              />
              {hasNextPage && (
                <Button onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>
                  {isFetchingNextPage ? 'Loading…' : 'Load more'}
                </Button>
              )}
            </>
          )}
        </div>

        <RecentActivity />
      </div>

      {pending && (
        <LifecycleDialog
          key={`${pending.tenant.id}:${pending.action}`}
          tenant={pending.tenant}
          action={pending.action}
          onClose={() => {
            setPending(null);
          }}
          onDone={(message) => {
            setPending(null);
            setNotice(message);
          }}
        />
      )}
    </div>
  );
}
