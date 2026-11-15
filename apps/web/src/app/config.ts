export const apiMode = import.meta.env.VITE_API_MODE ?? 'mock';

/**
 * The API lives at the origin root (`/api/v1`), not under the Vite base path.
 * The URL is absolute so the same code works in the browser and in Node tests.
 */
export const apiBaseUrl = new URL('/api/v1', window.location.origin).toString();
