import type { CategoryCreate } from 'contracts';
import { err, ok, type Result } from './result';

export const CATEGORY_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,19}$/;

export interface FieldError<F extends string = string> {
  field: F;
  message: string;
}

type CategoryField = 'code' | 'name' | 'glAccount';

/** Normalised category fields: trimmed, and an empty GL account becomes null. */
export type CategoryFields = Partial<{ code: string; name: string; glAccount: string | null }>;

/**
 * Validates the category fields that are present. Shared by the create/edit forms
 * and the backend, so both reject exactly the same input.
 */
export function validateCategoryFields(
  input: Partial<CategoryCreate>,
): Result<CategoryFields, FieldError<CategoryField>[]> {
  const errors: FieldError<CategoryField>[] = [];
  const fields: CategoryFields = {};

  if (input.code !== undefined) {
    const code = input.code.trim();
    if (!CATEGORY_CODE_PATTERN.test(code)) {
      errors.push({
        field: 'code',
        message: 'Use 2–20 capital letters, digits or _, starting with a letter (e.g. MEALS).',
      });
    }
    fields.code = code;
  }

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length === 0 || name.length > 60) {
      errors.push({ field: 'name', message: 'Enter a name of up to 60 characters.' });
    }
    fields.name = name;
  }

  if (input.glAccount !== undefined) {
    const glAccount = input.glAccount?.trim() ?? '';
    if (glAccount.length > 20) {
      errors.push({ field: 'glAccount', message: 'Keep the GL account under 20 characters.' });
    }
    fields.glAccount = glAccount === '' ? null : glAccount;
  }

  return errors.length > 0 ? err(errors) : ok(fields);
}
