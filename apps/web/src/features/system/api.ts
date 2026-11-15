import type { Health } from 'contracts';
import { api } from '../../app/api';

const systemApi = api.injectEndpoints({
  endpoints: (build) => ({
    getHealth: build.query<Health, undefined>({ query: () => 'health' }),
  }),
});

export const { useGetHealthQuery } = systemApi;
