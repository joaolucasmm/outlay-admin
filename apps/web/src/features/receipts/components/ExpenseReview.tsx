import { zodResolver } from '@hookform/resolvers/zod';
import { EMPLOYEE_ROLES, SUPPORTED_CURRENCIES } from '@outlay/domain';
import type { ExpenseCategory, PolicyRule, ReceiptExtraction, Tenant } from 'contracts';
import { useId, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Badge } from '../../../shared/ui/Badge';
import { ROLE_LABELS } from '../../policies/grid';
import {
  checkReviewedExpense,
  expenseSchema,
  initialValues,
  type ExpenseFormValues,
} from '../expenseForm';
import { PolicyResult } from './PolicyResult';

const CONFIDENCE_TONE = { high: 'success', medium: 'warning', low: 'danger' } as const;

interface ExpenseReviewProps {
  tenant: Tenant;
  categories: readonly ExpenseCategory[];
  rules: readonly PolicyRule[];
  /** null for manual entry. */
  extraction: ReceiptExtraction | null;
  hasReceipt: boolean;
}

const inputClass =
  'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 aria-[invalid=true]:border-red-500';

/** Review what the model read, fix it, and see the policy result update as you type. */
export function ExpenseReview({
  tenant,
  categories,
  rules,
  extraction,
  hasReceipt,
}: ExpenseReviewProps) {
  const ids = {
    merchant: useId(),
    date: useId(),
    amount: useId(),
    currency: useId(),
    categoryCode: useId(),
    role: useId(),
    legible: useId(),
  };
  const {
    register,
    watch,
    formState: { errors },
  } = useForm<ExpenseFormValues>({
    defaultValues: initialValues(extraction, tenant.currency),
    resolver: zodResolver(expenseSchema),
    mode: 'onTouched',
  });
  const values = watch();
  const result = checkReviewedExpense(values, {
    hasReceipt,
    tenantCurrency: tenant.currency,
    categories,
    rules,
  });

  const fromAi = (field: 'merchant' | 'date' | 'totalMinor' | 'suggestedCategoryCode') =>
    extraction?.[field] != null;
  const aiBadge = (filled: boolean) =>
    filled && (
      <span className="ml-2">
        <Badge tone="info">
          AI<span className="sr-only"> filled this in</span>
        </Badge>
      </span>
    );
  const error = (field: keyof ExpenseFormValues) =>
    errors[field] && (
      <p id={`${ids[field]}-error`} className="mt-1 text-sm text-red-700">
        {errors[field].message}
      </p>
    );
  const a11y = (field: keyof ExpenseFormValues) => ({
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `${ids[field]}-error` : undefined,
  });
  const label = (field: keyof ExpenseFormValues, text: string, extra?: ReactNode) => (
    <label htmlFor={ids[field]} className="flex items-center text-sm font-medium">
      {text}
      {extra}
    </label>
  );

  const currencies = SUPPORTED_CURRENCIES.includes(values.currency)
    ? SUPPORTED_CURRENCIES
    : [values.currency, ...SUPPORTED_CURRENCIES];

  return (
    <div className="space-y-4">
      {extraction && (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
          <p className="flex flex-wrap items-center gap-2">
            <Badge tone={CONFIDENCE_TONE[extraction.confidence]}>
              {extraction.confidence} confidence
            </Badge>
            <span className="text-slate-600">
              Read by {extraction.model} in {(extraction.latencyMs / 1000).toFixed(1)} s. Check
              every field before relying on it.
            </span>
          </p>
          {extraction.notes && <p className="mt-1 text-slate-700">{extraction.notes}</p>}
        </div>
      )}

      <form
        aria-label="Expense review"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
        }}
        className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2"
      >
        <div>
          {label('merchant', 'Merchant', aiBadge(fromAi('merchant')))}
          <input id={ids.merchant} className={inputClass} {...register('merchant')} />
        </div>
        <div>
          {label('date', 'Date', aiBadge(fromAi('date')))}
          <input id={ids.date} type="date" className={inputClass} {...register('date')} />
        </div>
        <div>
          {label('amount', 'Total', aiBadge(fromAi('totalMinor')))}
          <input
            id={ids.amount}
            inputMode="decimal"
            className={`${inputClass} tabular-nums`}
            {...a11y('amount')}
            {...register('amount')}
          />
          {error('amount')}
        </div>
        <div>
          {label('currency', 'Currency')}
          <select
            id={ids.currency}
            className={inputClass}
            {...a11y('currency')}
            {...register('currency')}
          >
            {currencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
          {error('currency')}
        </div>
        <div>
          {label('categoryCode', 'Category', aiBadge(fromAi('suggestedCategoryCode')))}
          <select
            id={ids.categoryCode}
            className={inputClass}
            {...a11y('categoryCode')}
            {...register('categoryCode')}
          >
            <option value="">Choose a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.code}>
                {category.name}
                {category.active ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
          {error('categoryCode')}
        </div>
        <div>
          {label('role', 'Spent by (employee role)')}
          <select id={ids.role} className={inputClass} {...a11y('role')} {...register('role')}>
            <option value="">Choose a role</option>
            {EMPLOYEE_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
          {error('role')}
        </div>
        {hasReceipt ? (
          <div className="flex items-start gap-2 text-sm sm:col-span-2">
            <input id={ids.legible} type="checkbox" className="mt-0.5" {...register('legible')} />
            <label htmlFor={ids.legible}>
              The receipt is legible
              <span className="block text-slate-600">
                You confirm this, not the AI. An illegible receipt counts as no receipt.
              </span>
            </label>
          </div>
        ) : (
          <p className="text-sm text-slate-600 sm:col-span-2">
            No receipt attached: the check treats the receipt as missing.
          </p>
        )}
      </form>

      <PolicyResult result={result} />
    </div>
  );
}
