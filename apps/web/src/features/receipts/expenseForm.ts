import { checkExpense, EMPLOYEE_ROLES, fromMinor, toMinor, type Expense } from '@outlay/domain';
import type {
  EmployeeRole,
  ExpenseCategory,
  PolicyCheckResult,
  PolicyRule,
  ReceiptExtraction,
} from 'contracts';
import { z } from 'zod';
import { formatMoney, fractionDigitsFor } from '../../shared/lib/money';

/** The review form. Everything the model extracted is only a starting point here. */
export interface ExpenseFormValues {
  merchant: string;
  date: string;
  amount: string;
  currency: string;
  categoryCode: string;
  role: EmployeeRole | '';
  legible: boolean;
}

export const expenseSchema = z
  .object({
    merchant: z.string(),
    date: z.string(),
    amount: z.string(),
    currency: z.string().min(1, 'Choose a currency.'),
    categoryCode: z.string().min(1, 'Choose a category.'),
    role: z.union([z.enum(EMPLOYEE_ROLES as [EmployeeRole, ...EmployeeRole[]]), z.literal('')]),
    legible: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.role === '') {
      ctx.addIssue({ code: 'custom', path: ['role'], message: 'Choose who spent it.' });
    }
    if (values.amount.trim() === '') {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Enter the total.' });
      return;
    }
    if (!values.currency) return;
    const minor = toMinor(values.amount, fractionDigitsFor(values.currency));
    if (!minor.ok) ctx.addIssue({ code: 'custom', path: ['amount'], message: minor.error.message });
  });

/** Starting values: what the model read, or blanks for manual entry. */
export function initialValues(
  extraction: ReceiptExtraction | null,
  tenantCurrency: string,
): ExpenseFormValues {
  const currency = extraction?.currency ?? tenantCurrency;
  return {
    merchant: extraction?.merchant ?? '',
    date: extraction?.date ?? '',
    amount:
      extraction?.totalMinor != null
        ? fromMinor(extraction.totalMinor, fractionDigitsFor(currency))
        : '',
    currency,
    categoryCode: extraction?.suggestedCategoryCode ?? '',
    role: '',
    // A starting point only: the reviewer confirms legibility (ADR 0003).
    legible: extraction ? extraction.confidence !== 'low' : false,
  };
}

interface CheckContext {
  hasReceipt: boolean;
  tenantCurrency: string;
  categories: readonly ExpenseCategory[];
  rules: readonly PolicyRule[];
}

/**
 * Runs the policy engine on the *reviewed* values, or returns null while the form is
 * incomplete. Model output never reaches the engine directly.
 */
export function checkReviewedExpense(
  values: ExpenseFormValues,
  { hasReceipt, tenantCurrency, categories, rules }: CheckContext,
): PolicyCheckResult | null {
  const parsed = expenseSchema.safeParse(values);
  if (!parsed.success || values.role === '') return null;
  const minor = toMinor(values.amount, fractionDigitsFor(values.currency));
  if (!minor.ok) return null;

  const expense: Expense = {
    amountMinor: minor.value,
    currency: values.currency,
    receipt: !hasReceipt ? 'missing' : values.legible ? 'readable' : 'unreadable',
  };
  return checkExpense(
    {
      expense,
      categoryCode: values.categoryCode,
      employeeRole: values.role,
      tenantCurrency,
      categories,
      rules,
    },
    { formatMoney: (amount) => formatMoney(amount, tenantCurrency) },
  );
}
