/** Demo receipts in `public/sample-receipts/` (BRL, so they fit Bluefin Logistics). */
export const SAMPLE_RECEIPTS = [
  { file: 'padaria-central.png', label: 'Bakery breakfast', hint: 'R$86.40' },
  { file: 'hotel-aurora.png', label: 'Hotel stay', hint: 'R$1,850.00' },
  { file: 'voo-horizonte.png', label: 'Flight', hint: 'R$1,240.00' },
  { file: 'cupom-ilegivel.png', label: 'Faded receipt', hint: 'unreadable' },
] as const;

export const sampleUrl = (file: string) => `${import.meta.env.BASE_URL}sample-receipts/${file}`;

/** Loads a sample as a File, so it goes through exactly the same path as an upload. */
export async function loadSample(file: string): Promise<File> {
  const response = await fetch(new URL(sampleUrl(file), window.location.href));
  if (!response.ok) throw new Error(`Could not load the sample receipt (${response.status}).`);
  return new File([await response.blob()], file, { type: 'image/png' });
}
