export const apiMode = import.meta.env.VITE_API_MODE ?? 'mock';
export const aiMode = import.meta.env.VITE_AI_MODE ?? 'mock';

/**
 * In mock mode the API lives at the origin root (`/api/v1`), not under the Vite base path,
 * where MSW answers. In live mode it is `VITE_API_URL` (services/tenant-api, e.g.
 * `http://localhost:8080/api/v1`). Always absolute, so the same code works in Node tests.
 */
export const apiBaseUrl =
  apiMode === 'live' && import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
    : new URL('/api/v1', window.location.origin).toString();

/**
 * The receipt extraction service. In live mode it is `VITE_AI_URL` (services/ai);
 * in mock mode MSW answers on the same origin, so the calling code is identical.
 */
export const aiBaseUrl =
  aiMode === 'live' && import.meta.env.VITE_AI_URL
    ? import.meta.env.VITE_AI_URL.replace(/\/$/, '')
    : new URL('/ai', window.location.origin).toString();
