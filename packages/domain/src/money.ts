import { err, ok, type Result } from './result';

export type MoneyInputError =
  | { code: 'invalid_amount'; message: string }
  | { code: 'too_many_decimals'; message: string }
  | { code: 'too_large'; message: string };

const AMOUNT = /^(\d+)(?:\.(\d+))?$/;

/**
 * Parses a user-typed amount in major units ("150", "150.5", "150.50") into integer
 * minor units, without floating-point maths. `fractionDigits` comes from the currency
 * (2 for BRL, 0 for JPY), resolved at the edge with Intl.
 */
export function toMinor(input: string, fractionDigits: number): Result<number, MoneyInputError> {
  const match = AMOUNT.exec(input.trim());
  if (!match) {
    return err({ code: 'invalid_amount', message: 'Enter an amount like 150 or 150.50.' });
  }
  const [, whole = '', fraction = ''] = match;
  if (fraction.length > fractionDigits) {
    return err({
      code: 'too_many_decimals',
      message:
        fractionDigits === 0
          ? 'This currency has no decimals.'
          : `Use at most ${fractionDigits} decimals.`,
    });
  }
  const minor = Number(whole + fraction.padEnd(fractionDigits, '0'));
  if (!Number.isSafeInteger(minor)) {
    return err({ code: 'too_large', message: 'The amount is too large.' });
  }
  return ok(minor);
}

/** Integer minor units back to a plain major-unit string for an input field ("150.00"). */
export function fromMinor(minor: number, fractionDigits: number): string {
  if (fractionDigits === 0) return String(minor);
  const digits = String(minor).padStart(fractionDigits + 1, '0');
  return `${digits.slice(0, -fractionDigits)}.${digits.slice(-fractionDigits)}`;
}
