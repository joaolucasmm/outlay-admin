import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../../mocks/node';
import { adminOf, operator, signedInAs } from '../../../test/personas';
import { renderApp } from '../../../test/renderApp';
import { dayBoundary } from './AuditPage';

const BLUEFIN = '/t/tnt_bluefin/audit';

const renderAudit = async (path = BLUEFIN, persona = adminOf('tnt_bluefin')) => {
  const utils = renderApp(path, signedInAs(persona));
  await screen.findByRole('heading', { name: 'Audit log' });
  return { ...utils, user: userEvent.setup() };
};

const actionsShown = () =>
  within(screen.getByRole('table', { name: 'Audit events' }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[2]?.textContent);

describe('AuditPage', () => {
  it('lists the tenant’s events, newest first', async () => {
    await renderAudit();
    await screen.findByRole('table', { name: 'Audit events' });

    expect(actionsShown()).toEqual([
      'Policy updated',
      'Category updated',
      'Tenant activated',
      'Tenant created',
    ]);
    const policyRow = screen.getByRole('row', { name: /Policy updated/ });
    expect(within(policyRow).getByText('Program Admin')).toBeInTheDocument();
    expect(within(policyRow).getByText('4 fields changed')).toBeInTheDocument();
  });

  it('shows a readable before/after diff, with money in the tenant currency', async () => {
    const { user } = await renderAudit();
    await screen.findByRole('table', { name: 'Audit events' });

    await user.click(screen.getByRole('button', { name: /View changes of Policy updated/ }));
    const drawer = screen.getByRole('dialog', { name: 'Policy updated' });

    const limit = within(drawer).getByRole('row', { name: /Meals · Manager › Limit/ });
    expect(within(limit).getByText('R$350.00')).toBeInTheDocument();
    expect(within(limit).getByText('R$400.00')).toBeInTheDocument();
    const removed = within(drawer).getByRole('row', {
      name: /Client entertainment · Manager › Approvals/,
    });
    expect(within(removed).getByText('Removed')).toBeInTheDocument();
    expect(within(removed).getByText('2 levels')).toBeInTheDocument();

    const toggle = within(drawer).getByRole('button', { name: 'Show raw JSON' });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(drawer).getAllByText(/cat_bluefin_meals:manager/)).toHaveLength(2);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows a suspension reason and its diff to the operator', async () => {
    const { user } = await renderAudit('/t/tnt_harbor/audit', operator);
    const row = await screen.findByRole('row', { name: /Tenant suspended/ });
    expect(within(row).getByText('Reason: Billing dispute')).toBeInTheDocument();
    expect(within(row).getByText('Harbor Health Group')).toBeInTheDocument();

    await user.click(within(row).getByRole('button', { name: /View changes/ }));
    const drawer = screen.getByRole('dialog', { name: 'Tenant suspended' });
    const status = within(drawer).getByRole('row', { name: /Status/ });
    expect(within(status).getByText('active')).toBeInTheDocument();
    expect(within(status).getByText('suspended')).toBeInTheDocument();
    expect(within(drawer).getByRole('row', { name: /Reason/ })).toHaveTextContent('Added');
  });

  it('filters by action through the URL, and clears', async () => {
    const { user, router } = await renderAudit();
    await screen.findByRole('table', { name: 'Audit events' });

    await user.selectOptions(screen.getByLabelText('Action'), 'Tenant activated');
    await waitFor(() => {
      expect(actionsShown()).toEqual(['Tenant activated']);
    });
    expect(router.state.location.search).toBe('?action=tenant.activated');

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => {
      expect(actionsShown()).toHaveLength(4);
    });
  });

  it('applies filters from a shared link, including a date range', async () => {
    await renderAudit(`${BLUEFIN}?from=2026-03-01&to=2026-03-31&actor=per_admin_tnt_bluefin`);
    await screen.findByRole('table', { name: 'Audit events' });

    expect(actionsShown()).toEqual(['Policy updated', 'Category updated']);
    expect(screen.getByLabelText('From')).toHaveValue('2026-03-01');
    expect(screen.getByLabelText('Actor')).toHaveValue('per_admin_tnt_bluefin');
  });

  it('rejects a reversed date range without calling the API', async () => {
    await renderAudit(`${BLUEFIN}?from=2026-03-31`);
    await screen.findByText('No audit events match your filters.');

    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-03-01' } });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The start date is after the end date.',
    );
    expect(screen.getByLabelText('From')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows an empty state when nothing matches', async () => {
    await renderAudit(`${BLUEFIN}?from=2025-01-01&to=2025-01-31`);
    expect(await screen.findByText('No audit events match your filters.')).toBeInTheDocument();
  });

  it('shows an error state with a retry', async () => {
    server.use(
      http.get('*/api/v1/audit-events', () =>
        HttpResponse.json({ type: 'about:blank', title: 'Boom', status: 500 }, { status: 500 }),
      ),
    );
    const { user } = await renderAudit();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load the audit log.');

    server.resetHandlers();
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('table', { name: 'Audit events' })).toBeInTheDocument();
  });
});

describe('dayBoundary', () => {
  it('turns a local calendar day into the instants where it starts and ends', () => {
    const start = new Date(dayBoundary('2026-03-01', 'start') ?? '');
    const end = new Date(dayBoundary('2026-03-01', 'end') ?? '');
    expect([start.getDate(), start.getHours(), start.getMinutes()]).toEqual([1, 0, 0]);
    expect([end.getDate(), end.getHours(), end.getMilliseconds()]).toEqual([1, 23, 999]);
  });

  it('ignores anything that is not a valid day', () => {
    expect(dayBoundary('', 'start')).toBeUndefined();
    expect(dayBoundary('2026-13-45', 'end')).toBeUndefined();
  });
});
