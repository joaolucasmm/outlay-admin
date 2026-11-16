import type { ReceiptExtraction } from 'contracts';
import { describe, expect, it } from 'vitest';
import { aiBaseUrl } from '../../app/config';

const extract = async (fileName: string, categories: unknown) => {
  const body = new FormData();
  body.append('image', new File(['png'], fileName, { type: 'image/png' }));
  body.append('categories', JSON.stringify(categories));
  const response = await fetch(`${aiBaseUrl}/v1/receipts/extract`, { method: 'POST', body });
  return { status: response.status, body: (await response.json()) as ReceiptExtraction };
};

describe('receipt extraction (mock AI service)', () => {
  it('returns the fixture for a sample receipt', async () => {
    const { status, body } = await extract('padaria-central.png', [
      { code: 'MEALS', name: 'Meals' },
    ]);
    expect(status).toBe(200);
    expect(body).toMatchObject({
      totalMinor: 8640,
      currency: 'BRL',
      suggestedCategoryCode: 'MEALS',
      confidence: 'high',
      model: 'demo-fixtures',
    });
  });

  it('drops a suggested category the tenant does not have', async () => {
    const { body } = await extract('padaria-central.png', [{ code: 'TRAVEL', name: 'Travel' }]);
    expect(body.suggestedCategoryCode).toBeNull();
  });

  it('answers an unknown file honestly, with low confidence', async () => {
    const { body } = await extract('my-receipt.png', []);
    expect(body).toMatchObject({ confidence: 'low', totalMinor: null });
    expect(body.notes).toContain('Demo mode only reads the sample receipts');
  });
});
