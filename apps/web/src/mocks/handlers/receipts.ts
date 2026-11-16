import type { Problem, ReceiptExtraction } from 'contracts';
import { delay, http, HttpResponse, passthrough, type DefaultBodyType } from 'msw';
import { aiMode } from '../../app/config';
import { RECEIPT_FIXTURES, UNKNOWN_FILE } from '../fixtures/receipts';
import { problem } from '../http';

/** Feels like a model call in the demo; instant in tests. */
const LATENCY_MS = import.meta.env.MODE === 'test' ? 0 : 1400;

const hintedCodes = (raw: FormDataEntryValue | null): Set<string> => {
  try {
    const parsed: unknown = JSON.parse(typeof raw === 'string' ? raw : '[]');
    return new Set(
      Array.isArray(parsed)
        ? parsed.flatMap((h: unknown) =>
            typeof h === 'object' && h !== null && 'code' in h && typeof h.code === 'string'
              ? [h.code]
              : [],
          )
        : [],
    );
  } catch {
    return new Set();
  }
};

/** Mock of services/ai: fixed extractions for the sample receipts (VITE_AI_MODE=mock). */
export const receiptHandlers = [
  http.post<never, DefaultBodyType, ReceiptExtraction | Problem>(
    '*/v1/receipts/extract',
    async ({ request }) => {
      if (aiMode !== 'mock') return passthrough();
      await delay(LATENCY_MS);
      const form = await request.formData();
      const image = form.get('image');
      // A form field is either a string or a file (no instanceof: File differs per realm).
      if (image === null || typeof image === 'string') {
        return problem(422, 'Invalid input', 'Send the receipt as the "image" field.');
      }
      const fixture = RECEIPT_FIXTURES[image.name] ?? UNKNOWN_FILE;
      const codes = hintedCodes(form.get('categories'));
      const suggested = fixture.suggestedCategoryCode;
      return HttpResponse.json<ReceiptExtraction>({
        ...fixture,
        // Like the real service: only codes the tenant actually has.
        suggestedCategoryCode: suggested && codes.has(suggested) ? suggested : null,
        model: 'demo-fixtures',
        promptVersion: 'v1',
        latencyMs: LATENCY_MS,
      });
    },
  ),
];
