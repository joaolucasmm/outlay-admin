import { Link } from 'react-router';
import { Button } from '../../../shared/ui/Button';
import { useGetCategoriesQuery } from '../../categories/api';
import { ReadOnlyBanner } from '../../tenants/components/ReadOnlyBanner';
import { useRouteTenant } from '../../tenants/useRouteTenant';
import { useGetPolicyRulesQuery } from '../api';
import { PolicyGrid } from '../components/PolicyGrid';

export function PoliciesPage() {
  const tenantQuery = useRouteTenant();
  const categoriesQuery = useGetCategoriesQuery(tenantQuery.tenantId);
  const rulesQuery = useGetPolicyRulesQuery(tenantQuery.tenantId);
  const queries = [tenantQuery, categoriesQuery, rulesQuery];

  const tenant = tenantQuery.data;
  const categories = categoriesQuery.data;
  const rules = rulesQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Policies</h1>
        <p className="mt-1 text-sm text-slate-600">
          Spending rules for each category and employee role. A role without a rule cannot use the
          category.
        </p>
      </div>

      {tenant && <ReadOnlyBanner tenant={tenant} />}

      {queries.some((q) => q.isLoading) ? (
        <p role="status" className="text-sm text-slate-600">
          Loading policy…
        </p>
      ) : queries.some((q) => q.isError) || !tenant || !categories || !rules ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <p>Could not load the policy.</p>
          <Button
            className="mt-3"
            onClick={() => {
              for (const q of queries) void q.refetch();
            }}
          >
            Retry
          </Button>
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm">
          <p className="font-medium">No categories yet.</p>
          <p className="mt-1 text-slate-600">
            Policy rules are set per category.{' '}
            <Link
              to={`/t/${tenant.id}/categories`}
              className="font-medium text-indigo-700 underline"
            >
              Create a category first
            </Link>
            .
          </p>
        </div>
      ) : (
        <PolicyGrid
          // A category was added: rebuild the form. After its own save the grid resets
          // itself, so a rules refetch must not remount it (that would drop the notice).
          key={categories.map((c) => c.id).join(',')}
          tenant={tenant}
          categories={categories}
          rules={rules}
          editable={tenantQuery.editable}
        />
      )}
    </div>
  );
}
