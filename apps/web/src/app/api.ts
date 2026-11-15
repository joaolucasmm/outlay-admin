import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { SessionState } from '../features/session/sessionSlice';
import { apiBaseUrl } from './config';

/** Header carrying the demo identity (ADR 0002). Replaced by real auth in M8. */
export const PERSONA_HEADER = 'X-Demo-Persona';

/**
 * Base RTK Query api. Each feature adds its endpoints with `api.injectEndpoints`
 * in its own `api.ts`, so this file never grows with feature code.
 */
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: apiBaseUrl,
    prepareHeaders: (headers, { getState }) => {
      const { session } = getState() as { session: SessionState };
      headers.set(PERSONA_HEADER, session.persona.id);
      return headers;
    },
  }),
  tagTypes: ['Tenant', 'Category', 'Policy', 'Employee', 'Audit'],
  endpoints: () => ({}),
});
