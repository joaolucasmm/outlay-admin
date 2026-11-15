import type { PolicyRule, PolicyRuleInput, PolicyRuleSet, PolicyRulesReplace } from 'contracts';
import { api } from '../../app/api';

const LIST = { type: 'Policy', id: 'LIST' } as const;
const url = (tenantId: string) => `tenants/${encodeURIComponent(tenantId)}/policy-rules`;

const policiesApi = api.injectEndpoints({
  endpoints: (build) => ({
    getPolicyRules: build.query<PolicyRule[], string>({
      query: url,
      transformResponse: (set: PolicyRuleSet) => set.items,
      providesTags: [LIST],
    }),

    replacePolicyRules: build.mutation<
      PolicyRule[],
      { tenantId: string; rules: PolicyRuleInput[] }
    >({
      query: ({ tenantId, rules }) => ({
        url: url(tenantId),
        method: 'PUT',
        body: { rules } satisfies PolicyRulesReplace,
      }),
      transformResponse: (set: PolicyRuleSet) => set.items,
      invalidatesTags: (result) => (result ? [LIST, 'Audit'] : []),
    }),
  }),
});

export const { useGetPolicyRulesQuery, useReplacePolicyRulesMutation } = policiesApi;
