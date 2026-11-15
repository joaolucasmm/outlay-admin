import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { apiBaseUrl } from './config';

/**
 * Base RTK Query api. Each feature adds its endpoints with `api.injectEndpoints`
 * in its own `api.ts`, so this file never grows with feature code.
 */
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: apiBaseUrl }),
  tagTypes: ['Tenant', 'Category', 'Policy', 'Employee', 'Audit'],
  endpoints: () => ({}),
});
