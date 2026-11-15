import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../../mocks/node';
import { renderApp } from '../../../test/renderApp';

const tenantNames = () =>
  within(screen.getByRole('table', { name: 'Tenants' }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent);

const rowFor = (name: string) => screen.getByRole('row', { name: new RegExp(name) });

const renderTenants = async () => {
  const utils = renderApp('/tenants');
  await screen.findByRole('table', { name: 'Tenants' });
  return { ...utils, user: userEvent.setup() };
};

describe('TenantsPage', () => {
  it('lists tenants by name, one page at a time', async () => {
    const { user } = await renderTenants();

    expect(tenantNames()).toEqual([
      'Bluefin Logistics',
      'Cedar & Pine Studio',
      'Harbor Health Group',
      'Kestrel Robotics',
      'Orbital Freight',
    ]);
    expect(within(rowFor('Harbor Health Group')).getByText('Suspended')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    await waitFor(() => {
      expect(tenantNames()).toHaveLength(8);
    });
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('searches by name and filters by status', async () => {
    const { user } = await renderTenants();

    await user.type(screen.getByLabelText('Search tenants'), 'har');
    await waitFor(() => {
      expect(tenantNames()).toEqual(['Harbor Health Group']);
    });

    await user.clear(screen.getByLabelText('Search tenants'));
    await user.selectOptions(screen.getByLabelText('Status'), 'Suspended');
    await waitFor(() => {
      expect(tenantNames()).toEqual(['Harbor Health Group', 'Orbital Freight']);
    });
  });

  it('shows an empty state that clears the filters', async () => {
    const { user } = await renderTenants();

    await user.type(screen.getByLabelText('Search tenants'), 'zzz');
    expect(await screen.findByText('No tenants match your filters.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByRole('table', { name: 'Tenants' })).toBeInTheDocument();
    expect(screen.getByLabelText('Search tenants')).toHaveValue('');
  });

  it('shows an error state with a retry', async () => {
    server.use(
      http.get('*/api/v1/tenants', () =>
        HttpResponse.json({ type: 'about:blank', title: 'Boom', status: 500 }, { status: 500 }),
      ),
    );
    renderApp('/tenants');
    const user = userEvent.setup();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load tenants.');

    server.resetHandlers();
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('table', { name: 'Tenants' })).toBeInTheDocument();
  });

  it('suspends a tenant with a reason and records it in recent activity', async () => {
    const { user } = await renderTenants();

    await user.click(screen.getByRole('button', { name: 'Suspend Bluefin Logistics' }));
    const dialog = screen.getByRole('dialog', { name: 'Suspend Bluefin Logistics?' });

    await user.click(within(dialog).getByRole('button', { name: 'Suspend' }));
    expect(await within(dialog).findByText('Enter a reason.')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Reason'), 'Unpaid invoices');
    await user.click(within(dialog).getByRole('button', { name: 'Suspend' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Bluefin Logistics suspended.')).toBeInTheDocument();
    await waitFor(() => {
      expect(within(rowFor('Bluefin Logistics')).getByText('Suspended')).toBeInTheDocument();
    });
    const activity = screen.getByRole('region', { name: 'Recent activity' });
    expect(await within(activity).findByText('Reason: Unpaid invoices')).toBeInTheDocument();
  });

  it('only deprovisions once the tenant name is typed', async () => {
    const { user } = await renderTenants();

    await user.click(screen.getByRole('button', { name: 'Deprovision Harbor Health Group' }));
    const dialog = screen.getByRole('dialog', { name: 'Deprovision Harbor Health Group?' });
    const confirm = within(dialog).getByRole('button', { name: 'Deprovision' });
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/to confirm/), 'Harbor Health Group');
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(await screen.findByText('Harbor Health Group deprovisioned.')).toBeInTheDocument();
    await waitFor(() => {
      expect(within(rowFor('Harbor Health Group')).getByText('Deprovisioned')).toBeInTheDocument();
    });
    expect(within(rowFor('Harbor Health Group')).queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows the server problem when a transition is rejected', async () => {
    server.use(
      http.post('*/api/v1/tenants/:tenantId/transitions', () =>
        HttpResponse.json(
          {
            type: 'https://outlay.example/problems/invalid-transition',
            title: 'Invalid transition',
            status: 409,
            detail: 'Cannot activate a tenant that is active.',
          },
          { status: 409 },
        ),
      ),
    );
    const { user } = await renderTenants();

    await user.click(screen.getByRole('button', { name: 'Reactivate Orbital Freight' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Reactivate' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Cannot activate a tenant that is active.',
    );
  });
});
