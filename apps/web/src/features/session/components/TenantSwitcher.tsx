import { useLocation, useNavigate } from 'react-router';
import { useAppDispatch, useAppSelector } from '../../../app/store';
import { Select } from '../../../shared/ui/Select';
import { pathForTenant } from '../navigation';
import { PLACEHOLDER_TENANTS } from '../placeholderTenants';
import { selectSession, setCurrentTenant } from '../sessionSlice';

/** Picks the Current Tenant. On a tenant-scoped page, it moves to the same page of the new tenant. */
export function TenantSwitcher() {
  const { currentTenantId } = useAppSelector(selectSession);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <Select
      label="Tenant"
      value={currentTenantId}
      options={PLACEHOLDER_TENANTS}
      onChange={(tenantId) => {
        dispatch(setCurrentTenant(tenantId));
        const next = pathForTenant(pathname, tenantId);
        if (next) void navigate(next);
      }}
    />
  );
}
