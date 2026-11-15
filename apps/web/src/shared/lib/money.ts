const formatters = new Map<string, Intl.NumberFormat>();

const formatterFor = (currency: string): Intl.NumberFormat => {
  let formatter = formatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en', { style: 'currency', currency });
    formatters.set(currency, formatter);
  }
  return formatter;
};

/** Decimal places of an ISO 4217 currency (2 for BRL, 0 for JPY), as Intl knows it. */
export const fractionDigitsFor = (currency: string): number =>
  formatterFor(currency).resolvedOptions().maximumFractionDigits ?? 2;

/** The only place money becomes text: integer minor units → "R$150.00". */
export const formatMoney = (minor: number, currency: string): string =>
  formatterFor(currency).format(minor / 10 ** fractionDigitsFor(currency));
