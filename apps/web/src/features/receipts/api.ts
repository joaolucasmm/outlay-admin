import type { ReceiptCategoryHint, ReceiptExtraction } from 'contracts';
import { api } from '../../app/api';
import { aiBaseUrl } from '../../app/config';

const receiptsApi = api.injectEndpoints({
  endpoints: (build) => ({
    /** services/ai (or its MSW mock): a mutation, since every call reads a new image. */
    extractReceipt: build.mutation<
      ReceiptExtraction,
      { image: File; categories: ReceiptCategoryHint[] }
    >({
      query: ({ image, categories }) => {
        const body = new FormData();
        body.append('image', image);
        body.append('categories', JSON.stringify(categories));
        return { url: `${aiBaseUrl}/v1/receipts/extract`, method: 'POST', body };
      },
    }),
  }),
});

export const { useExtractReceiptMutation } = receiptsApi;
