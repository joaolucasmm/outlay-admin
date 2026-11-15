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
  const { data } = useGetTenantsInfiniteQuery({ limit: 100 }, { skip: !isOperator });
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
      value={currentTenantId ?? ''}
      placeholder="Choose a tenant"
      options={options}
      onChange={(tenantId) => {
        dispatch(setCurrentTenant(tenantId));
        const next = pathForTenant(pathname, tenantId);
        if (next) void navigate(next);
      }}
    />
  );
}
