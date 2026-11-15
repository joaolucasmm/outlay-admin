import { matchPath } from 'react-router';
import type { AdminRole } from './sessionSlice';

export interface NavItem {
  label: string;
  to: string;
}

export const homePathFor = (role: AdminRole, tenantId: string): string =>
  role === 'support_operator' ? '/tenants' : `/t/${tenantId}/categories`;

export const navItemsFor = (role: AdminRole, tenantId: string): NavItem[] => {
  const tenantBase = `/t/${tenantId}`;
  if (role === 'support_operator') {
    return [
      { label: 'Tenants', to: '/tenants' },
      { label: 'New tenant', to: '/tenants/new' },
      { label: 'Audit log', to: `${tenantBase}/audit` },
    ];
  }
  return [
    { label: 'Categories', to: `${tenantBase}/categories` },
    { label: 'Policies', to: `${tenantBase}/policies` },
    { label: 'Employees', to: `${tenantBase}/employees` },
    { label: 'Receipts', to: `${tenantBase}/receipts` },
    { label: 'Audit log', to: `${tenantBase}/audit` },
  ];
};

/** On a tenant-scoped page, the same page for another tenant. Otherwise `null`. */
export const pathForTenant = (pathname: string, tenantId: string): string | null => {
  const match = matchPath('/t/:tenantId/*', pathname);
  return match ? `/t/${tenantId}/${match.params['*'] ?? ''}` : null;
};
