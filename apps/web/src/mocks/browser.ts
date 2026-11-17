import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
import { receiptHandlers } from './handlers/receipts';

/**
 * `all` serves the whole API (VITE_API_MODE=mock); `ai` only the receipt extraction, for a
 * live tenant API with mocked AI (VITE_API_MODE=live, VITE_AI_MODE=mock).
 */
export type MockScope = 'all' | 'ai';

/**
 * Registers the worker under the Vite base path (`/outlay-admin/` on GitHub Pages),
 * so it is served from, and scoped to, the app's own folder.
 */
export const startMockWorker = (scope: MockScope) =>
  setupWorker(...(scope === 'all' ? handlers : receiptHandlers)).start({
    serviceWorker: {
      url: `${import.meta.env.BASE_URL}mockServiceWorker.js`,
      options: { scope: import.meta.env.BASE_URL },
    },
    onUnhandledRequest: 'bypass',
  });
