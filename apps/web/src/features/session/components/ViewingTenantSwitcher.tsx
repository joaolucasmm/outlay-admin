import { useLocation, useNavigate } from 'react-router';
import { useAppDispatch, useAppSelector } from '../../../app/store';
import { Select } from '../../../shared/ui/Select';
import { useGetTenantsInfiniteQuery } from '../../tenants/api';
import { pathForTenant } from '../navigation';
import { selectSession, setCurrentTenant } from '../sessionSlice';

/** Support Operator only: picks which tenant the tenant-scoped pages show. */
export function ViewingTenantSwitcher() {
  const { persona, currentTenantId } = useAppSelector(selectSession);
  const isOperator = persona.role === 'support_operator';
  const { data, isLoading, isError } = useGetTenantsInfiniteQuery(
    { limit: 100 },
    { skip: !isOperator },
  );
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (!isOperator) return null;

  const options = (data?.pages.flatMap((page) => page.items) ?? []).map((tenant) => ({
    value: tenant.id,
    label: tenant.name,
  }));

  return (
    <Select
      label="Viewing tenant"
      // Until the list arrives (or if it fails) the select says why it is empty.
      value={options.some((o) => o.value === currentTenantId) ? (currentTenantId ?? '') : ''}
      placeholder={
        isLoading ? 'Loading tenants…' : isError ? 'Could not load tenants' : 'Choose a tenant'
      }
      disabled={isLoading || isError}
      options={options}
      onChange={(tenantId) => {
        dispatch(setCurrentTenant(tenantId));
        const next = pathForTenant(pathname, tenantId);
        if (next) void navigate(next);
      }}
    />
  );
}
