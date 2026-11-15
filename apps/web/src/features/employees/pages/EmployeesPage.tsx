import { EMPLOYEE_ROLES } from '@outlay/domain';
import type { ColumnDef } from '@tanstack/react-table';
import type { Employee, EmployeeRole } from 'contracts';
import { useId, useState } from 'react';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';
import { Button } from '../../../shared/ui/Button';
import { DataTable } from '../../../shared/ui/DataTable';
import { Select } from '../../../shared/ui/Select';
import { ROLE_LABELS } from '../../policies/grid';
import { ReadOnlyBanner } from '../../tenants/components/ReadOnlyBanner';
import { useRouteTenant } from '../../tenants/useRouteTenant';
import { useGetEmployeesInfiniteQuery } from '../api';
import { ImportEmployeesDialog } from '../components/ImportEmployeesDialog';

export const PAGE_SIZE = 10;

type RoleFilter = EmployeeRole | 'all';
const ROLE_OPTIONS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: 'All roles' },
  ...EMPLOYEE_ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
];

const columns: ColumnDef<Employee>[] = [
  {
    id: 'name',
    header: 'Name',
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  { id: 'email', header: 'Email', cell: ({ row }) => row.original.email },
  { id: 'role', header: 'Role', cell: ({ row }) => ROLE_LABELS[row.original.role] },
  { id: 'costCenter', header: 'Cost center', cell: ({ row }) => row.original.costCenter },
];

export function EmployeesPage() {
  const { tenantId, data: tenant, editable } = useRouteTenant();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<RoleFilter>('all');
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState('');
  const searchId = useId();
  const q = useDebouncedValue(search.trim());

  const { data, isLoading, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useGetEmployeesInfiniteQuery({
      tenantId,
      q: q || undefined,
      role: role === 'all' ? undefined : role,
      limit: PAGE_SIZE,
    });
  const employees = data?.pages.flatMap((page) => page.items) ?? [];
  const filtered = q !== '' || role !== 'all';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="mt-1 text-sm text-slate-600">
            People covered by this program. Their role decides which policy rules apply.
          </p>
        </div>
        <Button
          variant="primary"
          disabled={!editable}
          onClick={() => {
            setNotice('');
            setImporting(true);
          }}
        >
          Import CSV
        </Button>
      </div>

      {tenant && <ReadOnlyBanner tenant={tenant} />}

      <p
        role="status"
        className={
          notice ? 'rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800' : 'sr-only'
        }
      >
        {notice}
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor={searchId} className="text-slate-600">
            Search employees
          </label>
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Name or email…"
            className="rounded-md border border-slate-300 px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          />
        </div>
        <Select label="Role" value={role} options={ROLE_OPTIONS} onChange={setRole} />
      </div>

      {isLoading ? (
        <p role="status" className="text-sm text-slate-600">
          Loading employees…
        </p>
      ) : isError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <p>Could not load employees.</p>
          <Button className="mt-3" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : employees.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm">
          <p className="font-medium">
            {filtered ? 'No employees match your filters.' : 'No employees yet.'}
          </p>
          {filtered ? (
            <Button
              className="mt-3"
              onClick={() => {
                setSearch('');
                setRole('all');
              }}
            >
              Clear filters
            </Button>
          ) : (
            <p className="mt-1 text-slate-600">Import a CSV file to add them.</p>
          )}
        </div>
      ) : (
        <>
          <DataTable
            caption="Employees"
            data={employees}
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

      {importing && (
        <ImportEmployeesDialog
          tenantId={tenantId}
          onClose={() => {
            setImporting(false);
          }}
          onDone={(message) => {
            setImporting(false);
            setNotice(message);
          }}
        />
      )}
    </div>
  );
}
