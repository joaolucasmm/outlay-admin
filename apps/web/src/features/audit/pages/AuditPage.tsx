import type { ColumnDef } from '@tanstack/react-table';
import type { AuditEvent } from 'contracts';
import { useId, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAppSelector } from '../../../app/store';
import { formatDateTime } from '../../../shared/lib/dates';
import { Button } from '../../../shared/ui/Button';
import { DataTable } from '../../../shared/ui/DataTable';
import { Select } from '../../../shared/ui/Select';
import { useGetCategoriesQuery } from '../../categories/api';
import { useGetPersonasQuery } from '../../session/api';
import { selectRole } from '../../session/sessionSlice';
import { useRouteTenant } from '../../tenants/useRouteTenant';
import { useGetAuditLogInfiniteQuery, type AuditLogArgs } from '../api';
import { ChangesDrawer } from '../components/ChangesDrawer';
import { ACTION_LABELS, actionLabel, ENTITY_LABELS, entityLabel, ROLE_OF_ACTOR } from '../labels';
import type { PresentContext } from '../presentChange';
import { summarize } from '../summary';

export const PAGE_SIZE = 20;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A calendar day in the browser's time zone → the ISO instant where it starts or ends. */
export function dayBoundary(day: string, edge: 'start' | 'end'): string | undefined {
  if (!DAY.test(day)) return undefined;
  const date = new Date(`${day}T${edge === 'start' ? '00:00:00.000' : '23:59:59.999'}`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

const ALL = '' as const;

export function AuditPage() {
  const { tenantId, data: tenant } = useRouteTenant();
  const role = useAppSelector(selectRole);
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const fromId = useId();
  const toId = useId();

  const filters = {
    actor: params.get('actor') ?? ALL,
    action: params.get('action') ?? ALL,
    entity: params.get('entity') ?? ALL,
    from: params.get('from') ?? ALL,
    to: params.get('to') ?? ALL,
  };
  const filtered = Object.values(filters).some((value) => value !== ALL);
  const rangeError =
    filters.from && filters.to && filters.from > filters.to
      ? 'The start date is after the end date.'
      : '';

  const setFilter = (key: keyof typeof filters, value: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  };

  const args: AuditLogArgs = {
    tenantId,
    actorId: filters.actor || undefined,
    action: filters.action || undefined,
    entity: filters.entity || undefined,
    from: dayBoundary(filters.from, 'start'),
    to: dayBoundary(filters.to, 'end'),
    limit: PAGE_SIZE,
  };
  const { data, isLoading, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useGetAuditLogInfiniteQuery(args, { skip: rangeError !== '' });
  const events = data?.pages.flatMap((page) => page.items) ?? [];

  // Readable diffs: category names for whoever may read them, money in the tenant currency.
  const { data: categories } = useGetCategoriesQuery(tenantId, {
    skip: role !== 'program_admin',
  });
  const context: PresentContext = {
    ...(tenant ? { currency: tenant.currency } : {}),
    categoryNames: new Map(categories?.map((c) => [c.id, c.name]) ?? []),
  };

  const { data: personas } = useGetPersonasQuery(undefined);
  const actorOptions = [
    { value: ALL, label: 'Anyone' },
    ...(personas ?? [])
      .filter((p) => p.tenantId === null || p.tenantId === tenantId)
      .map((p) => ({ value: p.id, label: p.label })),
  ];

  // Categories are named; tenant-wide entities (tenant, policy grid, employees) show the tenant.
  const targetOf = (event: AuditEvent) =>
    event.entity === 'category'
      ? (context.categoryNames.get(event.entityId) ?? event.entityId)
      : (tenant?.name ?? event.entityId);

  const columns: ColumnDef<AuditEvent>[] = [
    {
      id: 'at',
      header: 'When',
      cell: ({ row }) => <time dateTime={row.original.at}>{formatDateTime(row.original.at)}</time>,
    },
    { id: 'actor', header: 'Actor', cell: ({ row }) => ROLE_OF_ACTOR[row.original.actor.role] },
    {
      id: 'action',
      header: 'Action',
      cell: ({ row }) => <span className="font-medium">{actionLabel(row.original.action)}</span>,
    },
    {
      id: 'target',
      header: 'Target',
      cell: ({ row }) => (
        <>
          <span className="block">{targetOf(row.original)}</span>
          <span className="text-xs text-slate-500">{entityLabel(row.original.entity)}</span>
        </>
      ),
    },
    {
      id: 'summary',
      header: 'Summary',
      cell: ({ row }) => <span className="text-slate-600">{summarize(row.original)}</span>,
    },
    {
      id: 'details',
      header: () => <span className="sr-only">Details</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              setSelected(row.original);
            }}
          >
            View changes
            <span className="sr-only">
              {' '}
              of {actionLabel(row.original.action)} on {formatDateTime(row.original.at)}
            </span>
          </Button>
        </div>
      ),
    },
  ];

  const dateInput =
    'rounded-md border border-slate-300 bg-white px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 aria-[invalid=true]:border-red-500';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-slate-600">
          Every change to {tenant?.name ?? 'this tenant'}, newest first. Open an entry to see what
          changed.
        </p>
      </div>

      <div
        role="group"
        aria-label="Filters"
        className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-white p-4"
      >
        <Select
          label="Actor"
          value={filters.actor}
          options={actorOptions}
          onChange={(value) => {
            setFilter('actor', value);
          }}
        />
        <Select
          label="Action"
          value={filters.action}
          options={[
            { value: ALL, label: 'Any action' },
            ...Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label })),
          ]}
          onChange={(value) => {
            setFilter('action', value);
          }}
        />
        <Select
          label="Entity"
          value={filters.entity}
          options={[
            { value: ALL, label: 'Any entity' },
            ...Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label })),
          ]}
          onChange={(value) => {
            setFilter('entity', value);
          }}
        />
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor={fromId} className="text-slate-600">
            From
          </label>
          <input
            id={fromId}
            type="date"
            value={filters.from}
            aria-invalid={rangeError ? true : undefined}
            onChange={(event) => {
              setFilter('from', event.target.value);
            }}
            className={dateInput}
          />
          <label htmlFor={toId} className="text-slate-600">
            To
          </label>
          <input
            id={toId}
            type="date"
            value={filters.to}
            aria-invalid={rangeError ? true : undefined}
            onChange={(event) => {
              setFilter('to', event.target.value);
            }}
            className={dateInput}
          />
        </div>
        {filtered && (
          <Button
            size="sm"
            onClick={() => {
              setParams(new URLSearchParams());
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {rangeError ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {rangeError}
        </p>
      ) : isLoading ? (
        <p role="status" className="text-sm text-slate-600">
          Loading audit log…
        </p>
      ) : isError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <p>Could not load the audit log.</p>
          <Button className="mt-3" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm">
          <p className="font-medium">
            {filtered ? 'No audit events match your filters.' : 'No activity yet.'}
          </p>
        </div>
      ) : (
        <>
          <DataTable
            caption="Audit events"
            data={events}
            columns={columns}
            getRowId={(e) => e.id}
          />
          {hasNextPage && (
            <Button onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>
              {isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          )}
        </>
      )}

      {selected && (
        <ChangesDrawer
          event={selected}
          context={context}
          onClose={() => {
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
