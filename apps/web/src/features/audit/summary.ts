import type { AuditEvent } from 'contracts';
import { diffJson } from '../../shared/lib/jsonDiff';

const field = (value: unknown, key: string): unknown =>
  typeof value === 'object' && value !== null && key in value
    ? (value as Record<string, unknown>)[key]
    : undefined;

export const reasonOf = (event: AuditEvent): string | null => {
  const reason = field(event.after, 'reason');
  return typeof reason === 'string' ? reason : null;
};

/** A one-line description of what an event changed, for the audit table. */
export function summarize(event: AuditEvent): string {
  const reason = reasonOf(event);
  if (reason) return `Reason: ${reason}`;
  const imported = field(event.after, 'imported');
  if (typeof imported === 'number') return `${imported} employee${imported === 1 ? '' : 's'}`;
  const categories = field(event.after, 'categoriesCreated');
  const rules = field(event.after, 'rulesCreated');
  if (typeof categories === 'number' && typeof rules === 'number') {
    return `${categories} categories, ${rules} rules`;
  }
  const changes = diffJson(event.before, event.after).length;
  return `${changes} field${changes === 1 ? '' : 's'} changed`;
}
