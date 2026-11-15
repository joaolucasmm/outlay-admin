import type { LifecycleCommand, ListTenantsQuery, Tenant, TenantPage } from 'contracts';
import { api } from '../../app/api';

export type TenantListArgs = Pick<ListTenantsQuery, 'q' | 'status' | 'limit'>;

const tenantsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getTenants: build.infiniteQuery<TenantPage, TenantListArgs, string | null>({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
      query: ({ queryArg, pageParam }) => ({
        url: 'tenants',
        params: { ...queryArg, cursor: pageParam ?? undefined },
      }),
      providesTags: (result) => [
        { type: 'Tenant', id: 'LIST' },
        ...(result?.pages.flatMap((page) =>
          page.items.map((tenant) => ({ type: 'Tenant' as const, id: tenant.id })),
        ) ?? []),
      ],
    }),

    getTenant: build.query<Tenant, string>({
      query: (tenantId) => `tenants/${encodeURIComponent(tenantId)}`,
      providesTags: (_result, _error, tenantId) => [{ type: 'Tenant', id: tenantId }],
    }),

    transitionTenant: build.mutation<Tenant, { tenantId: string; command: LifecycleCommand }>({
      query: ({ tenantId, command }) => ({
        url: `tenants/${encodeURIComponent(tenantId)}/transitions`,
        method: 'POST',
        body: command,
      }),
      // Also on errors: a 409 means our copy of the tenant is stale.
      invalidatesTags: (_result, _error, { tenantId }) => [
        { type: 'Tenant', id: tenantId },
        { type: 'Tenant', id: 'LIST' },
        'Audit',
      ],
    }),
  }),
});

export const { useGetTenantsInfiniteQuery, useGetTenantQuery, useTransitionTenantMutation } =
  tenantsApi;
