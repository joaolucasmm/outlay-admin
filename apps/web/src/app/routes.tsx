import type { Permission } from '@outlay/domain';
import type { ReactNode } from 'react';
import { Navigate, type RouteObject } from 'react-router';
import { AppLayout } from './layout/AppLayout';
import { LiveApiGap } from './layout/LiveApiGap';
import { NotFoundPage } from './layout/NotFoundPage';
import { RouteErrorPage } from './layout/RouteErrorPage';
import { TenantScope } from './layout/TenantScope';
import { useAppSelector } from './store';
import { AuditPage } from '../features/audit/pages/AuditPage';
import { CategoriesPage } from '../features/categories/pages/CategoriesPage';
import { EmployeesPage } from '../features/employees/pages/EmployeesPage';
import { OnboardingPage } from '../features/onboarding/pages/OnboardingPage';
import { PoliciesPage } from '../features/policies/pages/PoliciesPage';
import { ReceiptsPage } from '../features/receipts/pages/ReceiptsPage';
import { RequirePermission } from '../features/session/components/RequirePermission';
import { homePathFor } from '../features/session/navigation';
import { selectPersona } from '../features/session/sessionSlice';
import { TenantsPage } from '../features/tenants/pages/TenantsPage';

function HomeRedirect() {
  const persona = useAppSelector(selectPersona);
  return <Navigate to={homePathFor(persona)} replace />;
}

const guard = (permission: Permission, element: ReactNode) => (
  <RequirePermission permission={permission}>{element}</RequirePermission>
);

/** A tenant program page, which the live tenant API does not serve until M8b. */
const program = (feature: string, element: ReactNode) =>
  guard('tenant:configure', <LiveApiGap feature={feature}>{element}</LiveApiGap>);

const onboarding = (
  <LiveApiGap
    feature="New tenant"
    partial="Live API: creating the tenant works, but applying the category template and importing employees arrive with milestone M8b, so provisioning stops at those steps."
  >
    <OnboardingPage />
  </LiveApiGap>
);

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'tenants', element: guard('tenants:list', <TenantsPage />) },
      { path: 'tenants/new', element: guard('tenants:create', onboarding) },
      { path: 'tenants/new/:step', element: guard('tenants:create', onboarding) },
      {
        path: 't/:tenantId',
        element: <TenantScope />,
        children: [
          { path: 'categories', element: program('Expense categories', <CategoriesPage />) },
          { path: 'policies', element: program('Spending policies', <PoliciesPage />) },
          { path: 'employees', element: program('Employees', <EmployeesPage />) },
          { path: 'receipts', element: program('Receipt check', <ReceiptsPage />) },
          { path: 'audit', element: guard('audit:read', <AuditPage />) },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
