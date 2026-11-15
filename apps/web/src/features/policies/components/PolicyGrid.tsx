import { zodResolver } from '@hookform/resolvers/zod';
import { EMPLOYEE_ROLES, toMinor } from '@outlay/domain';
import type { ExpenseCategory, PolicyRule, Tenant } from 'contracts';
import { useEffect, useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { useBlocker } from 'react-router';
import { formatMoney, fractionDigitsFor } from '../../../shared/lib/money';
import { problemMessage } from '../../../shared/lib/problem';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { useReplacePolicyRulesMutation } from '../api';
import {
  cellKey,
  gridSchema,
  ROLE_LABELS,
  toGridValues,
  toRuleInputs,
  type Cell,
  type GridValues,
} from '../grid';

interface PolicyGridProps {
  tenant: Tenant;
  categories: readonly ExpenseCategory[];
  rules: readonly PolicyRule[];
  editable: boolean;
}

const APPROVAL_LABELS = { '0': 'Auto-approve', '1': '1 level', '2': '2 levels' } as const;

const inputClass =
  'w-28 rounded-md border border-slate-300 px-2 py-1.5 text-right tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 aria-[invalid=true]:border-red-500';

export function PolicyGrid({ tenant, categories, rules, editable }: PolicyGridProps) {
  const currency = tenant.currency;
  const digits = fractionDigitsFor(currency);
  const [replaceRules, { isLoading: isSaving, error: saveError }] = useReplacePolicyRulesMutation();
  const [notice, setNotice] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty, dirtyFields },
  } = useForm<GridValues>({
    defaultValues: toGridValues(categories, rules, digits),
    resolver: zodResolver(gridSchema(digits)),
  });
  const cells = watch('cells');

  // Unsaved-changes guard: in-app navigation…
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname,
  );
  // …and reloads or closing the tab.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
    };
  }, [isDirty]);

  const onSave = handleSubmit(async (values) => {
    setNotice('');
    const result = await replaceRules({ tenantId: tenant.id, rules: toRuleInputs(values, digits) });
    if (result.data) {
      reset(toGridValues(categories, result.data, digits));
      setNotice('Policy saved.');
    }
  });

  const changedRows = Object.keys(dirtyFields.cells ?? {}).length;
  const cellErrors = (key: string): FieldErrors<Cell> | undefined => errors.cells?.[key];

  const readOnlyAmount = (value: string) => {
    const minor = toMinor(value, digits);
    return minor.ok ? formatMoney(minor.value, currency) : value;
  };

  return (
    <form onSubmit={(event) => void onSave(event)} noValidate className="space-y-4">
      {editable && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <p className="text-sm text-slate-600" aria-live="polite">
            {isDirty
              ? `${changedRows} unsaved ${changedRows === 1 ? 'change' : 'changes'}`
              : 'All changes saved'}
          </p>
          <div className="flex gap-2">
            <Button
              disabled={!isDirty || isSaving}
              onClick={() => {
                reset();
                setNotice('');
              }}
            >
              Discard
            </Button>
            <Button type="submit" variant="primary" disabled={!isDirty || isSaving}>
              {isSaving ? 'Saving…' : 'Save policy'}
            </Button>
          </div>
        </div>
      )}

      <p
        role="status"
        className={
          notice ? 'rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800' : 'sr-only'
        }
      >
        {notice}
      </p>
      {saveError && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          Could not save the policy: {problemMessage(saveError)}
        </p>
      )}
      {Object.keys(errors.cells ?? {}).length > 0 && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          Fix the highlighted cells before saving.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <caption className="sr-only">Policy grid: category × employee role</caption>
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th scope="col" className="px-4 py-2.5">
                Category
              </th>
              <th scope="col" className="px-4 py-2.5">
                Role
              </th>
              <th scope="col" className="px-4 py-2.5">
                Limit ({currency})
              </th>
              <th scope="col" className="px-4 py-2.5">
                Receipt above ({currency})
              </th>
              <th scope="col" className="px-4 py-2.5">
                Approvals
              </th>
              <th scope="col" className="px-4 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          {categories.map((category) => (
            <tbody
              key={category.id}
              className={`border-t border-slate-200 ${category.active ? '' : 'text-slate-500'}`}
            >
              {EMPLOYEE_ROLES.map((role, index) => {
                const key = cellKey(category.id, role);
                const cell = cells[key];
                if (!cell) return null;
                const where = `${category.name}, ${ROLE_LABELS[role]}`;
                const dirty = Boolean(dirtyFields.cells?.[key]);
                const err = cellErrors(key);
                const errorId = (field: string) => `${key}-${field}-error`;
                const fieldError = (field: 'limit' | 'receiptAbove') =>
                  err?.[field] && (
                    <p id={errorId(field)} className="mt-1 max-w-40 text-xs text-red-700">
                      {err[field].message}
                    </p>
                  );

                return (
                  <tr key={role} className={dirty ? 'bg-amber-50' : undefined}>
                    {index === 0 && (
                      <th
                        scope="rowgroup"
                        rowSpan={EMPLOYEE_ROLES.length}
                        className="px-4 py-3 text-left align-top font-medium"
                      >
                        <span className="block">{category.name}</span>
                        <code className="text-xs font-normal text-slate-500">{category.code}</code>
                        {!category.active && (
                          <span className="mt-1 block">
                            <Badge tone="neutral">Inactive</Badge>
                          </span>
                        )}
                      </th>
                    )}
                    <th scope="row" className="px-4 py-3 text-left font-normal">
                      {ROLE_LABELS[role]}
                      {dirty && <span className="sr-only"> (changed)</span>}
                    </th>

                    {!cell.allowed ? (
                      <td colSpan={3} className="px-4 py-3 text-slate-500">
                        Not allowed
                      </td>
                    ) : !editable ? (
                      <>
                        <td className="px-4 py-3 tabular-nums">{readOnlyAmount(cell.limit)}</td>
                        <td className="px-4 py-3 tabular-nums">
                          {readOnlyAmount(cell.receiptAbove)}
                        </td>
                        <td className="px-4 py-3">{APPROVAL_LABELS[cell.approvals]}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2 align-top">
                          <input
                            inputMode="decimal"
                            aria-label={`Limit, ${where}`}
                            aria-invalid={err?.limit ? true : undefined}
                            aria-describedby={err?.limit ? errorId('limit') : undefined}
                            className={inputClass}
                            {...register(`cells.${key}.limit`)}
                          />
                          {fieldError('limit')}
                        </td>
                        <td className="px-4 py-2 align-top">
                          <input
                            inputMode="decimal"
                            aria-label={`Receipt required above, ${where}`}
                            aria-invalid={err?.receiptAbove ? true : undefined}
                            aria-describedby={
                              err?.receiptAbove ? errorId('receiptAbove') : undefined
                            }
                            className={inputClass}
                            {...register(`cells.${key}.receiptAbove`)}
                          />
                          {fieldError('receiptAbove')}
                        </td>
                        <td className="px-4 py-2 align-top">
                          <select
                            aria-label={`Approvals, ${where}`}
                            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            {...register(`cells.${key}.approvals`)}
                          >
                            {(['0', '1', '2'] as const).map((value) => (
                              <option key={value} value={value}>
                                {APPROVAL_LABELS[value]}
                              </option>
                            ))}
                          </select>
                        </td>
                      </>
                    )}

                    <td className="px-4 py-2 text-right align-top">
                      {editable && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setValue(`cells.${key}.allowed`, !cell.allowed, {
                              shouldDirty: true,
                            });
                          }}
                        >
                          {cell.allowed ? 'Disallow' : 'Allow'}
                          <span className="sr-only"> {where}</span>
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>

      {blocker.state === 'blocked' && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) blocker.reset();
          }}
          title="Discard unsaved changes?"
          description="You have policy changes that are not saved. If you leave this page, they are lost."
        >
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                blocker.reset();
              }}
            >
              Stay on this page
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                blocker.proceed();
              }}
            >
              Discard and leave
            </Button>
          </div>
        </Dialog>
      )}
    </form>
  );
}
