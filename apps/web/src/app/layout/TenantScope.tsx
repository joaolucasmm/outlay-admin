import { useEffect } from 'react';
import { Outlet, useParams } from 'react-router';
import { useAppDispatch, useAppSelector } from '../store';
import { NotAuthorized } from '../../features/session/components/NotAuthorized';
import { selectSession, setCurrentTenant } from '../../features/session/sessionSlice';

/**
 * Wraps tenant-scoped routes. A Program Admin may only open their own tenant.
 * For a Support Operator, the `:tenantId` in the URL becomes the Current Tenant.
 */
export function TenantScope() {
  const { tenantId = '' } = useParams();
  const { persona, currentTenantId } = useAppSelector(selectSession);
  const dispatch = useAppDispatch();
  const outOfScope = persona.role === 'program_admin' && persona.tenantId !== tenantId;

  useEffect(() => {
    if (!outOfScope && tenantId !== currentTenantId) dispatch(setCurrentTenant(tenantId));
  }, [outOfScope, tenantId, currentTenantId, dispatch]);

  if (outOfScope) return <NotAuthorized reason="This tenant is outside your scope." />;
  return <Outlet />;
}
