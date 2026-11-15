import type { CategoryCreate, CategoryPage, CategoryUpdate, ExpenseCategory } from 'contracts';
import { api } from '../../app/api';

const LIST = { type: 'Category', id: 'LIST' } as const;
const base = (tenantId: string) => `tenants/${encodeURIComponent(tenantId)}/categories`;

const categoriesApi = api.injectEndpoints({
  endpoints: (build) => ({
    /** A tenant has a handful of categories: one page of 100 is the whole list. */
    getCategories: build.query<ExpenseCategory[], string>({
      query: (tenantId) => ({ url: base(tenantId), params: { limit: 100 } }),
      transformResponse: (page: CategoryPage) => page.items,
      providesTags: [LIST],
    }),

    createCategory: build.mutation<ExpenseCategory, { tenantId: string; body: CategoryCreate }>({
      query: ({ tenantId, body }) => ({ url: base(tenantId), method: 'POST', body }),
      invalidatesTags: (result) => (result ? [LIST, 'Audit'] : []),
    }),

    updateCategory: build.mutation<
      ExpenseCategory,
      { tenantId: string; categoryId: string; body: CategoryUpdate }
    >({
      query: ({ tenantId, categoryId, body }) => ({
        url: `${base(tenantId)}/${encodeURIComponent(categoryId)}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (result) => (result ? [LIST, 'Audit'] : []),
    }),

    /** Optimistic: the switch flips at once and flips back if the server refuses. */
    setCategoryActive: build.mutation<
      ExpenseCategory,
      { tenantId: string; categoryId: string; active: boolean }
    >({
      query: ({ tenantId, categoryId, active }) => ({
        url: `${base(tenantId)}/${encodeURIComponent(categoryId)}`,
        method: 'PATCH',
        body: { active } satisfies CategoryUpdate,
      }),
      async onQueryStarted({ tenantId, categoryId, active }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          categoriesApi.util.updateQueryData('getCategories', tenantId, (draft) => {
            const category = draft.find((c) => c.id === categoryId);
            if (category) category.active = active;
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (result) => (result ? ['Audit'] : []),
    }),
  }),
});

export const {
  useGetCategoriesQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useSetCategoryActiveMutation,
} = categoriesApi;
