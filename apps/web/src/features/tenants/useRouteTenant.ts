import { canEditProgram } from '@outlay/domain';
import { useParams } from 'react-router';
import { useGetTenantQuery } from './api';

/** The tenant of a `/t/:tenantId/...` page, and whether its program can be edited. */
export function useRouteTenant() {
  const { tenantId = '' } = useParams();
  const query = useGetTenantQuery(tenantId);
  return {
    tenantId,
    ...query,
    editable: query.data ? canEditProgram(query.data) : false,
  };
}
