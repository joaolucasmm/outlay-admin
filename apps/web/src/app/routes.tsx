import { Navigate, type RouteObject } from 'react-router';
import { AppLayout } from './layout/AppLayout';
import { TenantScope } from './layout/TenantScope';
import { useAppSelector } from './store';
import { homePathFor } from '../features/session/navigation';
import { selectSession } from '../features/session/sessionSlice';
import { PlaceholderPage } from '../shared/ui/PlaceholderPage';

function HomeRedirect() {
  const { currentRole, currentTenantId } = useAppSelector(selectSession);
  return <Navigate to={homePathFor(currentRole, currentTenantId)} replace />;
}

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: 'tenants', element: <PlaceholderPage title="Tenants" milestone="M1" /> },
      { path: 'tenants/new', element: <PlaceholderPage title="New tenant" milestone="M3" /> },
      {
        path: 't/:tenantId',
        element: <TenantScope />,
        children: [
          { path: 'categories', element: <PlaceholderPage title="Categories" milestone="M2" /> },
          { path: 'policies', element: <PlaceholderPage title="Policies" milestone="M2" /> },
          { path: 'employees', element: <PlaceholderPage title="Employees" milestone="M3" /> },
          { path: 'receipts', element: <PlaceholderPage title="Receipts" milestone="M5" /> },
          { path: 'audit', element: <PlaceholderPage title="Audit log" milestone="M4" /> },
        ],
      },
      { path: '*', element: <PlaceholderPage title="Page not found" /> },
    ],
  },
];
