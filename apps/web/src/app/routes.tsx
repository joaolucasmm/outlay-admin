import type { Permission } from '@outlay/domain';
import type { ReactNode } from 'react';
import { Navigate, type RouteObject } from 'react-router';
import { AppLayout } from './layout/AppLayout';
import { TenantScope } from './layout/TenantScope';
import { useAppSelector } from './store';
import { CategoriesPage } from '../features/categories/pages/CategoriesPage';
import { EmployeesPage } from '../features/employees/pages/EmployeesPage';
import { OnboardingPage } from '../features/onboarding/pages/OnboardingPage';
import { PoliciesPage } from '../features/policies/pages/PoliciesPage';
import { RequirePermission } from '../features/session/components/RequirePermission';
import { homePathFor } from '../features/session/navigation';
import { selectPersona } from '../features/session/sessionSlice';
import { TenantsPage } from '../features/tenants/pages/TenantsPage';
import { PlaceholderPage } from '../shared/ui/PlaceholderPage';

function HomeRedirect() {
  const persona = useAppSelector(selectPersona);
  return <Navigate to={homePathFor(persona)} replace />;
}

const guard = (permission: Permission, element: ReactNode) => (
  <RequirePermission permission={permission}>{element}</RequirePermission>
);

const placeholder = (title: string, milestone: string) => (
  <PlaceholderPage title={title} milestone={milestone} />
);

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'tenants', element: guard('tenants:list', <TenantsPage />) },
      { path: 'tenants/new', element: guard('tenants:create', <OnboardingPage />) },
      { path: 'tenants/new/:step', element: guard('tenants:create', <OnboardingPage />) },
      {
        path: 't/:tenantId',
        element: <TenantScope />,
        children: [
          { path: 'categories', element: guard('tenant:configure', <CategoriesPage />) },
          { path: 'policies', element: guard('tenant:configure', <PoliciesPage />) },
          { path: 'employees', element: guard('tenant:configure', <EmployeesPage />) },
          { path: 'receipts', element: guard('tenant:configure', placeholder('Receipts', 'M5')) },
          { path: 'audit', element: guard('audit:read', placeholder('Audit log', 'M4')) },
        ],
      },
      { path: '*', element: <PlaceholderPage title="Page not found" /> },
    ],
  },
];
