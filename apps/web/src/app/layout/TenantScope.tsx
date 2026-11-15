import { useEffect } from 'react';
import { Outlet, useParams } from 'react-router';
import { useAppDispatch, useAppSelector } from '../store';
import { selectSession, setCurrentTenant } from '../../features/session/sessionSlice';

/** Wraps tenant-scoped routes: the `:tenantId` in the URL wins over the session. */
export function TenantScope() {
  const { tenantId } = useParams();
  const { currentTenantId } = useAppSelector(selectSession);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (tenantId && tenantId !== currentTenantId) dispatch(setCurrentTenant(tenantId));
  }, [tenantId, currentTenantId, dispatch]);

  return <Outlet />;
}
