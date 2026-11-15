import type { Persona } from 'contracts';
import { api } from '../../app/api';

const sessionApi = api.injectEndpoints({
  endpoints: (build) => ({
    getPersonas: build.query<Persona[], undefined>({
      query: () => 'demo/personas',
      // Deprovisioning a tenant removes its Program Admin persona.
      providesTags: [{ type: 'Tenant', id: 'LIST' }],
    }),
    resetDemo: build.mutation<undefined, undefined>({
      query: () => ({ url: 'demo/reset', method: 'POST' }),
    }),
  }),
});

export const { useGetPersonasQuery, useResetDemoMutation } = sessionApi;
