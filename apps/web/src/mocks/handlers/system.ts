import { http, HttpResponse } from 'msw';
import type { Health } from 'contracts';

export const systemHandlers = [
  http.get('*/api/v1/health', () => HttpResponse.json<Health>({ status: 'ok', mode: 'mock' })),
];
