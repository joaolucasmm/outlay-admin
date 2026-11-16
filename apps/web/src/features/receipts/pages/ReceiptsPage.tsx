import type { ReceiptExtraction } from 'contracts';
import { useEffect, useId, useState } from 'react';
import { aiMode } from '../../../app/config';
import { problemMessage } from '../../../shared/lib/problem';
import { Button } from '../../../shared/ui/Button';
import { useGetCategoriesQuery } from '../../categories/api';
import { useGetPolicyRulesQuery } from '../../policies/api';
import { useRouteTenant } from '../../tenants/useRouteTenant';
import { useExtractReceiptMutation } from '../api';
import { ExpenseReview } from '../components/ExpenseReview';
import { loadSample, SAMPLE_RECEIPTS } from '../samples';

type Review =
  | { kind: 'none' }
  | { kind: 'manual' }
  | { kind: 'receipt'; file: File; extraction: ReceiptExtraction | null; failed: string | null };

export function ReceiptsPage() {
  const tenantQuery = useRouteTenant();
  const categoriesQuery = useGetCategoriesQuery(tenantQuery.tenantId);
  const rulesQuery = useGetPolicyRulesQuery(tenantQuery.tenantId);
  const [extractReceipt, { isLoading: extracting }] = useExtractReceiptMutation();
  const [review, setReview] = useState<Review>({ kind: 'none' });
  const [preview, setPreview] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [round, setRound] = useState(0);
  const fileId = useId();

  const tenant = tenantQuery.data;
  const categories = categoriesQuery.data;
  const rules = rulesQuery.data;
  const queries = [tenantQuery, categoriesQuery, rulesQuery];

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const read = async (file: File) => {
    setLoadError('');
    setPreview(URL.createObjectURL(file));
    setReview({ kind: 'receipt', file, extraction: null, failed: null });
    // The model may suggest one of the tenant's active categories, nothing else.
    const hints = (categories ?? [])
      .filter((c) => c.active)
      .map((c) => ({ code: c.code, name: c.name }));
    const result = await extractReceipt({ image: file, categories: hints });
    setRound((n) => n + 1);
    setReview(
      result.data
        ? { kind: 'receipt', file, extraction: result.data, failed: null }
        : { kind: 'receipt', file, extraction: null, failed: problemMessage(result.error) },
    );
  };

  const readSample = async (name: string) => {
    try {
      await read(await loadSample(name));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load the sample.');
    }
  };

  if (queries.some((q) => q.isLoading)) {
    return (
      <p role="status" className="text-sm text-slate-600">
        Loading…
      </p>
    );
  }
  if (!tenant || !categories || !rules) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
      >
        <p>Could not load the expense program.</p>
        <Button
          className="mt-3"
          onClick={() => {
            for (const q of queries) void q.refetch();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  const showForm =
    review.kind === 'manual' || (review.kind === 'receipt' && !extracting && round > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Receipts</h1>
        <p className="mt-1 text-sm text-slate-600">
          Upload a receipt: AI reads it, you check the fields, and the policy rules decide.
          {aiMode === 'mock' && ' Demo mode reads the sample receipts only.'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <section aria-labelledby="receipt-source" className="space-y-4">
          <h2 id="receipt-source" className="text-sm font-semibold">
            Receipt
          </h2>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <label htmlFor={fileId} className="block text-sm font-medium">
              Receipt image
            </label>
            <p className="text-xs text-slate-600">JPEG, PNG or WebP, up to 5 MB.</p>
            <input
              id={fileId}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={extracting}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void read(file);
              }}
              className="mt-2 w-full text-sm file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-50"
            />
            <p className="mt-4 text-sm font-medium">Or try a sample</p>
            <ul className="mt-2 grid grid-cols-2 gap-2">
              {SAMPLE_RECEIPTS.map((sample) => (
                <li key={sample.file}>
                  <Button
                    size="sm"
                    className="w-full flex-col"
                    disabled={extracting}
                    onClick={() => void readSample(sample.file)}
                  >
                    {sample.label}
                    <span className="font-normal text-slate-500">{sample.hint}</span>
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              size="sm"
              className="mt-4"
              disabled={extracting}
              onClick={() => {
                setPreview(null);
                setRound((n) => n + 1);
                setReview({ kind: 'manual' });
              }}
            >
              No receipt: fill in manually
            </Button>
          </div>
          {loadError && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
              {loadError}
            </p>
          )}
          {preview && review.kind === 'receipt' && (
            <img
              src={preview}
              alt={`Receipt preview: ${review.file.name}`}
              className="max-h-[32rem] w-full rounded-lg border border-slate-200 bg-white object-contain"
            />
          )}
        </section>

        <section aria-labelledby="review-title" className="space-y-4" aria-busy={extracting}>
          <h2 id="review-title" className="text-sm font-semibold">
            Review
          </h2>
          {review.kind === 'none' && (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
              Choose a receipt or a sample to start.
            </p>
          )}
          {extracting && (
            <p role="status" className="rounded-lg border border-slate-200 bg-white p-6 text-sm">
              Reading the receipt…
            </p>
          )}
          {review.kind === 'receipt' && review.failed && !extracting && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
              The AI service could not read the receipt: {review.failed} You can still fill in the
              fields and check the policy.
            </p>
          )}
          {showForm && (
            <ExpenseReview
              key={round}
              tenant={tenant}
              categories={categories}
              rules={rules}
              extraction={review.kind === 'receipt' ? review.extraction : null}
              hasReceipt={review.kind === 'receipt'}
            />
          )}
        </section>
      </div>
    </div>
  );
}
