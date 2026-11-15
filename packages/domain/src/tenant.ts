import type { TenantCreate } from 'contracts';
import type { FieldError } from './category';
import { err, ok, type Result } from './result';

export interface SupportedCountry {
  code: string;
  name: string;
  /** Default currency, which onboarding lets you change. */
  currency: string;
}

export const SUPPORTED_COUNTRIES: readonly SupportedCountry[] = [
  { code: 'BR', name: 'Brazil', currency: 'BRL' },
  { code: 'CA', name: 'Canada', currency: 'CAD' },
  { code: 'DE', name: 'Germany', currency: 'EUR' },
  { code: 'ES', name: 'Spain', currency: 'EUR' },
  { code: 'MX', name: 'Mexico', currency: 'MXN' },
  { code: 'PT', name: 'Portugal', currency: 'EUR' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
  { code: 'US', name: 'United States', currency: 'USD' },
];

export const SUPPORTED_CURRENCIES: readonly string[] = ['BRL', 'CAD', 'EUR', 'GBP', 'MXN', 'USD'];

export const defaultCurrencyFor = (country: string): string | undefined =>
  SUPPORTED_COUNTRIES.find((c) => c.code === country)?.currency;

type TenantField = 'name' | 'country' | 'currency';

/** Validates a new tenant. Shared by the onboarding wizard and the backend. */
export function validateNewTenant(
  input: TenantCreate,
): Result<TenantCreate, FieldError<TenantField>[]> {
  const errors: FieldError<TenantField>[] = [];
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 80) {
    errors.push({ field: 'name', message: 'Enter a company name of 2 to 80 characters.' });
  }
  if (!defaultCurrencyFor(input.country)) {
    errors.push({ field: 'country', message: 'Choose a supported country.' });
  }
  if (!SUPPORTED_CURRENCIES.includes(input.currency)) {
    errors.push({ field: 'currency', message: 'Choose a supported currency.' });
  }
  return errors.length > 0
    ? err(errors)
    : ok({ name, country: input.country, currency: input.currency });
}

/** Tenant names are unique ignoring case and repeated spaces. */
export const sameTenantName = (a: string, b: string): boolean =>
  a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase();
