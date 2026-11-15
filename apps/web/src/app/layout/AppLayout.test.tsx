import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../mocks/node';
import { adminOf, signedInAs } from '../../test/personas';
import { renderApp } from '../../test/renderApp';

const navLabels = () =>
  within(screen.getByRole('navigation', { name: 'Main' }))
    .getAllByRole('link')
    .map((link) => link.textContent);

describe('App layout (smoke)', () => {
  it('lands the Support Operator on Tenants and shows the mock API is up', async () => {
    const { router } = renderApp('/');

    expect(await screen.findByRole('heading', { level: 1, name: 'Tenants' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/tenants');
    expect(navLabels()).toEqual(['Tenants', 'New tenant']);
    expect(await screen.findByText('Mock API: ok')).toBeInTheDocument();
  });

  it('signs in as a Program Admin, scoped to their tenant', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/');
    const personaSelect = screen.getByLabelText('Signed in as');
    await screen.findByRole('option', { name: 'Program Admin · Bluefin Logistics' });

    await user.selectOptions(personaSelect, 'Program Admin · Bluefin Logistics');

    expect(await screen.findByRole('heading', { name: 'Categories' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/t/tnt_bluefin/categories');
    expect(navLabels()).toEqual(['Categories', 'Policies', 'Employees', 'Receipts', 'Audit log']);
    expect(screen.queryByLabelText('Viewing tenant')).not.toBeInTheDocument();
  });

  it('lets the Support Operator choose which tenant to view', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/');
    await screen.findByRole('option', { name: 'Harbor Health Group' });

    await user.selectOptions(screen.getByLabelText('Viewing tenant'), 'Harbor Health Group');
    await user.click(screen.getByRole('link', { name: 'Audit log' }));
    expect(router.state.location.pathname).toBe('/t/tnt_harbor/audit');

    await user.selectOptions(screen.getByLabelText('Viewing tenant'), 'Kestrel Robotics');
    expect(router.state.location.pathname).toBe('/t/tnt_kestrel/audit');
  });

  it('falls back to the Support Operator when the saved persona no longer exists', async () => {
    const { router } = renderApp(
      '/t/tnt_quarrylane/audit',
      signedInAs(adminOf('tnt_quarrylane', 'Quarry Lane Architects')),
    );

    expect(await screen.findByRole('heading', { name: 'Tenants' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/tenants');
    expect(screen.getByLabelText('Signed in as')).toHaveValue('per_operator');
  });

  it('shows when the API is unreachable', async () => {
    server.use(http.get('*/api/v1/health', () => HttpResponse.error()));
    renderApp('/tenants');

    expect(await screen.findByText('API unreachable')).toBeInTheDocument();
  });
});
