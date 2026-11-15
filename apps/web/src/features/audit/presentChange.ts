import type { EmployeeRole } from 'contracts';
import type { DiffEntry } from '../../shared/lib/jsonDiff';
import { formatMoney } from '../../shared/lib/money';
import { ROLE_LABELS } from '../policies/grid';

export interface PresentContext {
  /** Tenant currency, to format `*Minor` amounts. */
  currency?: string;
  /** Category id → name, when the viewer can read categories. */
  categoryNames: ReadonlyMap<string, string>;
}

const FIELD_LABELS: Record<string, string> = {
  limitMinor: 'Limit',
  receiptRequiredAboveMinor: 'Receipt above',
  approvalLevels: 'Approvals',
  glAccount: 'GL account',
  costCenter: 'Cost center',
  templateId: 'Template',
  categoriesCreated: 'Categories created',
  rulesCreated: 'Rules created',
  createdAt: 'Created at',
  updatedAt: 'Updated at',
  tenantId: 'Tenant id',
};

const RULE_KEY = /^(.+):(employee|manager|director)$/;

const humanize = (key: string) => {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** One path segment as a reader would name it, e.g. `cat_x:manager` → "Meals · Manager". */
function labelSegment(segment: string, ctx: PresentContext): string {
  const rule = RULE_KEY.exec(segment);
  if (rule) {
    const [, categoryId = '', role] = rule;
    return `${ctx.categoryNames.get(categoryId) ?? categoryId} · ${ROLE_LABELS[role as EmployeeRole]}`;
  }
  return FIELD_LABELS[segment] ?? humanize(segment);
}

export const labelPath = (path: readonly string[], ctx: PresentContext): string =>
  path.length === 0 ? 'Value' : path.map((segment) => labelSegment(segment, ctx)).join(' › ');

/** A value as text: money in the tenant currency, approvals in words, absent as "—". */
export function formatValue(value: unknown, path: readonly string[], ctx: PresentContext): string {
  if (value === undefined || value === null) return '—';
  const field = path.at(-1) ?? '';
  if (typeof value === 'number' && field.endsWith('Minor') && ctx.currency) {
    return formatMoney(value, ctx.currency);
  }
  if (field === 'approvalLevels' && typeof value === 'number') {
    return value === 0 ? 'Auto-approve' : `${value} level${value === 1 ? '' : 's'}`;
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

export interface PresentedChange {
  key: string;
  label: string;
  kind: DiffEntry['kind'];
  before: string;
  after: string;
}

export const presentChanges = (
  entries: readonly DiffEntry[],
  ctx: PresentContext,
): PresentedChange[] =>
  entries.map((entry) => ({
    key: entry.path.join('/'),
    label: labelPath(entry.path, ctx),
    kind: entry.kind,
    before: formatValue(entry.before, entry.path, ctx),
    after: formatValue(entry.after, entry.path, ctx),
  }));
