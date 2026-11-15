import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

/**
 * Registers the worker under the Vite base path (`/outlay-admin/` on GitHub Pages),
 * so it is served from, and scoped to, the app's own folder.
 */
export const startMockWorker = () =>
  worker.start({
    serviceWorker: {
      url: `${import.meta.env.BASE_URL}mockServiceWorker.js`,
      options: { scope: import.meta.env.BASE_URL },
    },
    onUnhandledRequest: 'bypass',
  });
