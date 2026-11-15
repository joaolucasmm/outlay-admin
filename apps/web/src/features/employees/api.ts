import type {
  EmployeeImport,
  EmployeeInput,
  EmployeePage,
  ImportResult,
  ListEmployeesQuery,
} from 'contracts';
import { api } from '../../app/api';

const LIST = { type: 'Employee', id: 'LIST' } as const;
const base = (tenantId: string) => `tenants/${encodeURIComponent(tenantId)}/employees`;

export type EmployeeListArgs = { tenantId: string } & Pick<
  ListEmployeesQuery,
  'q' | 'role' | 'limit'
>;

const employeesApi = api.injectEndpoints({
  endpoints: (build) => ({
    getEmployees: build.infiniteQuery<EmployeePage, EmployeeListArgs, string | null>({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
      query: ({ queryArg: { tenantId, ...params }, pageParam }) => ({
        url: base(tenantId),
        params: { ...params, cursor: pageParam ?? undefined },
      }),
      providesTags: [LIST],
    }),

    importEmployees: build.mutation<ImportResult, { tenantId: string; employees: EmployeeInput[] }>(
      {
        query: ({ tenantId, employees }) => ({
          url: `${base(tenantId)}:import`,
          method: 'POST',
          body: { employees } satisfies EmployeeImport,
        }),
        invalidatesTags: (result) => (result ? [LIST, 'Audit'] : []),
      },
    ),
  }),
});

export const { useGetEmployeesInfiniteQuery, useImportEmployeesMutation } = employeesApi;
