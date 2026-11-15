import type { ColumnDef } from '@tanstack/react-table';
import type { ExpenseCategory } from 'contracts';
import { useState } from 'react';
import { problemMessage } from '../../../shared/lib/problem';
import { Button } from '../../../shared/ui/Button';
import { DataTable } from '../../../shared/ui/DataTable';
import { Switch } from '../../../shared/ui/Switch';
import { ReadOnlyBanner } from '../../tenants/components/ReadOnlyBanner';
import { useRouteTenant } from '../../tenants/useRouteTenant';
import { useGetCategoriesQuery, useSetCategoryActiveMutation } from '../api';
import { CategoryDialog } from '../components/CategoryDialog';

type Editing = { mode: 'create' } | { mode: 'edit'; category: ExpenseCategory } | null;

export function CategoriesPage() {
  const { tenantId, data: tenant, editable } = useRouteTenant();
  const { data: categories, isLoading, isError, refetch } = useGetCategoriesQuery(tenantId);
  const [setActive] = useSetCategoryActiveMutation();
  const [editing, setEditing] = useState<Editing>(null);
  const [notice, setNotice] = useState('');
  const [toggleError, setToggleError] = useState('');

  const toggle = async (category: ExpenseCategory, active: boolean) => {
    setNotice('');
    setToggleError('');
    const result = await setActive({ tenantId, categoryId: category.id, active });
    if ('error' in result) {
      setToggleError(
        `Could not ${active ? 'activate' : 'deactivate'} ${category.name}: ${problemMessage(result.error)} The change was undone.`,
      );
    }
  };

  const columns: ColumnDef<ExpenseCategory>[] = [
    {
      id: 'code',
      header: 'Code',
      cell: ({ row }) => <code className="text-xs">{row.original.code}</code>,
    },
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      id: 'glAccount',
      header: 'GL account',
      cell: ({ row }) =>
        row.original.glAccount ?? (
          <span className="text-slate-400">
            —<span className="sr-only">none</span>
          </span>
        ),
    },
    {
      id: 'active',
      header: 'Status',
      cell: ({ row }) => (
        <Switch
          checked={row.original.active}
          label={`${row.original.name} active`}
          disabled={!editable}
          onChange={(active) => void toggle(row.original, active)}
        />
      ),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!editable}
            onClick={() => {
              setNotice('');
              setEditing({ mode: 'edit', category: row.original });
            }}
          >
            Edit<span className="sr-only"> {row.original.name}</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
          <p className="mt-1 text-sm text-slate-600">
            What this program reimburses. Inactive categories are rejected by the policy check.
          </p>
        </div>
        <Button
          variant="primary"
          disabled={!editable}
          onClick={() => {
            setNotice('');
            setEditing({ mode: 'create' });
          }}
        >
          New category
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
      {toggleError && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {toggleError}
        </p>
      )}

      {isLoading ? (
        <p role="status" className="text-sm text-slate-600">
          Loading categories…
        </p>
      ) : isError || !categories ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <p>Could not load categories.</p>
          <Button className="mt-3" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm">
          <p className="font-medium">No categories yet.</p>
          <p className="mt-1 text-slate-600">
            Create the first one to start defining policy rules.
          </p>
        </div>
      ) : (
        <DataTable
          caption="Categories"
          data={categories}
          columns={columns}
          getRowId={(c) => c.id}
        />
      )}

      {editing && (
        <CategoryDialog
          key={editing.mode === 'edit' ? editing.category.id : 'new'}
          tenantId={tenantId}
          {...(editing.mode === 'edit' ? { category: editing.category } : {})}
          onClose={() => {
            setEditing(null);
          }}
          onDone={(message) => {
            setEditing(null);
            setNotice(message);
          }}
        />
      )}
    </div>
  );
}
