import type {
  ApplyTemplate,
  CategoryTemplateId,
  LifecycleCommand,
  ListTenantsQuery,
  Tenant,
  TenantCreate,
  TenantPage,
  TemplateResult,
} from 'contracts';
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

    /** One-off lookup (e.g. "is this name taken?"), separate from the paginated list cache. */
    searchTenants: build.query<TenantPage, TenantListArgs>({
      query: (params) => ({ url: 'tenants', params }),
      keepUnusedDataFor: 0,
    }),

    createTenant: build.mutation<Tenant, TenantCreate>({
      query: (body) => ({ url: 'tenants', method: 'POST', body }),
      invalidatesTags: (result) => (result ? [{ type: 'Tenant', id: 'LIST' }, 'Audit'] : []),
    }),

    applyCategoryTemplate: build.mutation<
      TemplateResult,
      { tenantId: string; templateId: CategoryTemplateId }
    >({
      query: ({ tenantId, templateId }) => ({
        url: `tenants/${encodeURIComponent(tenantId)}/program:apply-template`,
        method: 'POST',
        body: { templateId } satisfies ApplyTemplate,
      }),
      invalidatesTags: (result) => (result ? ['Category', 'Policy', 'Audit'] : []),
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

export const {
  useGetTenantsInfiniteQuery,
  useGetTenantQuery,
  useLazySearchTenantsQuery,
  useCreateTenantMutation,
  useApplyCategoryTemplateMutation,
  useTransitionTenantMutation,
} = tenantsApi;
