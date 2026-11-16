import type { ReceiptExtraction } from 'contracts';

type Fixture = Omit<ReceiptExtraction, 'model' | 'promptVersion' | 'latencyMs'>;

/**
 * What the extraction service returns for the demo receipts in
 * `public/sample-receipts/` (drawn by services/ai/evals/generate_receipts.py).
 */
export const RECEIPT_FIXTURES: Record<string, Fixture> = {
  'padaria-central.png': {
    merchant: 'Padaria Central Ltda',
    date: '2026-11-10',
    totalMinor: 8640,
    currency: 'BRL',
    suggestedCategoryCode: 'MEALS',
    confidence: 'high',
    notes: null,
  },
  'hotel-aurora.png': {
    merchant: 'Hotel Aurora',
    date: '2026-11-05',
    totalMinor: 185000,
    currency: 'BRL',
    suggestedCategoryCode: 'LODGING',
    confidence: 'high',
    notes: null,
  },
  'voo-horizonte.png': {
    merchant: 'Linhas Aereas Horizonte',
    date: '2026-11-03',
    totalMinor: 124000,
    currency: 'BRL',
    suggestedCategoryCode: 'TRAVEL',
    confidence: 'high',
    notes: null,
  },
  'cupom-ilegivel.png': {
    merchant: null,
    date: null,
    totalMinor: null,
    currency: null,
    suggestedCategoryCode: null,
    confidence: 'low',
    notes: 'The receipt is too faded to read. Fill in the fields manually.',
  },
};

export const UNKNOWN_FILE: Fixture = {
  merchant: null,
  date: null,
  totalMinor: null,
  currency: null,
  suggestedCategoryCode: null,
  confidence: 'low',
  notes:
    'Demo mode only reads the sample receipts. Fill in the fields from your receipt, or run the AI service in live mode.',
};
