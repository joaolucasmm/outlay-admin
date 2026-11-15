import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../mocks/node';
import { renderApp } from '../../test/renderApp';

const navLabels = () =>
  within(screen.getByRole('navigation', { name: 'Main' }))
    .getAllByRole('link')
    .map((link) => link.textContent);

describe('App layout (smoke)', () => {
  it('lands a Support Operator on Tenants and shows the mock API is up', async () => {
    const { router } = renderApp('/');

    expect(await screen.findByRole('heading', { level: 1, name: 'Tenants' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/tenants');
    expect(navLabels()).toEqual(['Tenants', 'New tenant', 'Audit log']);
    expect(await screen.findByText('Mock API: ok')).toBeInTheDocument();
  });

  it('switches role and tenant from the header', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/');
    await screen.findByRole('heading', { name: 'Tenants' });

    await user.selectOptions(screen.getByLabelText('Role'), 'Program Admin');
    expect(await screen.findByRole('heading', { name: 'Categories' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/t/tnt_bluefin/categories');
    expect(navLabels()).toEqual(['Categories', 'Policies', 'Employees', 'Receipts', 'Audit log']);

    await user.selectOptions(screen.getByLabelText('Tenant'), 'Harbor Health Group');
    expect(router.state.location.pathname).toBe('/t/tnt_harbor/categories');
    expect(screen.getByRole('link', { name: 'Policies' })).toHaveAttribute(
      'href',
      '/t/tnt_harbor/policies',
    );
  });

  it('takes the tenant from the URL on a deep link', async () => {
    renderApp('/t/tnt_cedarpine/audit', {
      session: { currentRole: 'program_admin', currentTenantId: 'tnt_bluefin' },
    });

    expect(await screen.findByRole('heading', { name: 'Audit log' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tenant')).toHaveValue('tnt_cedarpine');
  });

  it('shows when the API is unreachable', async () => {
    server.use(http.get('*/api/v1/health', () => HttpResponse.error()));
    renderApp('/tenants');

    expect(await screen.findByText('API unreachable')).toBeInTheDocument();
  });
});
