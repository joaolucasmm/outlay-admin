import type { Persona } from 'contracts';
import { matchPath } from 'react-router';

export interface NavItem {
  label: string;
  to: string;
}

export const homePathFor = (persona: Persona): string =>
  persona.tenantId ? `/t/${persona.tenantId}/categories` : '/tenants';

export const navItemsFor = (persona: Persona, currentTenantId: string | null): NavItem[] => {
  if (persona.role === 'support_operator') {
    return [
      { label: 'Tenants', to: '/tenants' },
      { label: 'New tenant', to: '/tenants/new' },
      ...(currentTenantId ? [{ label: 'Audit log', to: `/t/${currentTenantId}/audit` }] : []),
    ];
  }
  const base = `/t/${persona.tenantId ?? ''}`;
  return [
    { label: 'Categories', to: `${base}/categories` },
    { label: 'Policies', to: `${base}/policies` },
    { label: 'Employees', to: `${base}/employees` },
    { label: 'Receipts', to: `${base}/receipts` },
    { label: 'Audit log', to: `${base}/audit` },
  ];
};

/** On a tenant-scoped page, the same page for another tenant. Otherwise `null`. */
export const pathForTenant = (pathname: string, tenantId: string): string | null => {
  const match = matchPath('/t/:tenantId/*', pathname);
  return match ? `/t/${tenantId}/${match.params['*'] ?? ''}` : null;
};
