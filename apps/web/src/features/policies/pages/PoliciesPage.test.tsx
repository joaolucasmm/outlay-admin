import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { db } from '../../../mocks/db';
import { adminOf, signedInAs } from '../../../test/personas';
import { renderApp } from '../../../test/renderApp';

const renderPolicies = async (tenantId = 'tnt_bluefin') => {
  const utils = renderApp(`/t/${tenantId}/policies`, signedInAs(adminOf(tenantId)));
  await screen.findByRole('table', { name: /Policy grid/ });
  return { ...utils, user: userEvent.setup() };
};

const mealsRule = (role: string) => {
  const meals = db.categories('tnt_bluefin').find((c) => c.code === 'MEALS');
  return db.policyRules('tnt_bluefin').find((r) => r.categoryId === meals?.id && r.role === role);
};

describe('PoliciesPage', () => {
  it('shows each rule in the tenant currency', async () => {
    await renderPolicies();

    expect(screen.getByRole('columnheader', { name: 'Limit (BRL)' })).toBeInTheDocument();
    expect(screen.getByLabelText('Limit, Meals, Manager')).toHaveValue('400.00');
    expect(screen.getByLabelText('Receipt required above, Meals, Manager')).toHaveValue('125.00');
    expect(screen.getByLabelText('Approvals, Travel, Employee')).toHaveValue('1');
    // Client entertainment is only allowed for directors.
    expect(
      screen.queryByLabelText('Limit, Client entertainment, Employee'),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText('Not allowed')).toHaveLength(2);
  });

  it('validates cells with the domain rules before saving', async () => {
    const { user } = await renderPolicies();
    const limit = screen.getByLabelText('Limit, Meals, Manager');

    await user.clear(limit);
    await user.type(limit, '100.505');
    const receipt = screen.getByLabelText('Receipt required above, Meals, Employee');
    await user.clear(receipt);
    await user.type(receipt, '999');
    await user.click(screen.getByRole('button', { name: 'Save policy' }));

    expect(await screen.findByText('Use at most 2 decimals.')).toBeInTheDocument();
    expect(
      screen.getByText('The receipt threshold cannot be above the limit.'),
    ).toBeInTheDocument();
    expect(limit).toHaveAttribute('aria-invalid', 'true');
    expect(mealsRule('manager')?.limitMinor).toBe(40000);
  });

  it('saves the grid and marks it clean', async () => {
    const { user } = await renderPolicies();
    const limit = screen.getByLabelText('Limit, Meals, Manager');

    await user.clear(limit);
    await user.type(limit, '450.5');
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Manager \(changed\)/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save policy' }));

    expect(await screen.findByText('Policy saved.')).toBeInTheDocument();
    expect(mealsRule('manager')?.limitMinor).toBe(45050);
    await waitFor(() => {
      expect(screen.getByLabelText('Limit, Meals, Manager')).toHaveValue('450.50');
    });
    expect(screen.getByText('All changes saved')).toBeInTheDocument();
  });

  it('allows and disallows a category for a role', async () => {
    const { user } = await renderPolicies();

    await user.click(screen.getByRole('button', { name: 'Allow Client entertainment, Employee' }));
    await user.type(screen.getByLabelText('Limit, Client entertainment, Employee'), '100');
    await user.type(
      screen.getByLabelText('Receipt required above, Client entertainment, Employee'),
      '0',
    );
    await user.click(screen.getByRole('button', { name: 'Disallow Meals, Director' }));
    await user.click(screen.getByRole('button', { name: 'Save policy' }));

    expect(await screen.findByText('Policy saved.')).toBeInTheDocument();
    expect(mealsRule('director')).toBeUndefined();
    const ent = db.categories('tnt_bluefin').find((c) => c.code === 'CLIENT_ENT');
    expect(
      db.policyRules('tnt_bluefin').find((r) => r.categoryId === ent?.id && r.role === 'employee'),
    ).toMatchObject({ limitMinor: 10000, receiptRequiredAboveMinor: 0 });
  });

  it('discards changes', async () => {
    const { user } = await renderPolicies();
    const limit = screen.getByLabelText('Limit, Meals, Manager');

    await user.clear(limit);
    await user.type(limit, '1');
    await user.click(screen.getByRole('button', { name: 'Discard' }));

    expect(limit).toHaveValue('400.00');
    expect(screen.getByRole('button', { name: 'Save policy' })).toBeDisabled();
  });

  it('asks before leaving with unsaved changes', async () => {
    const { user, router } = await renderPolicies();
    await user.type(screen.getByLabelText('Limit, Meals, Manager'), '9');

    await user.click(screen.getByRole('link', { name: 'Categories' }));
    const dialog = await screen.findByRole('dialog', { name: 'Discard unsaved changes?' });

    await user.click(within(dialog).getByRole('button', { name: 'Stay on this page' }));
    expect(router.state.location.pathname).toBe('/t/tnt_bluefin/policies');
    expect(screen.getByLabelText('Limit, Meals, Manager')).toHaveValue('400.009');

    await user.click(screen.getByRole('link', { name: 'Categories' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Discard and leave' }),
    );
    expect(await screen.findByRole('heading', { name: 'Categories' })).toBeInTheDocument();
  });

  it('is read-only, with formatted money, for a suspended tenant', async () => {
    await renderPolicies('tnt_harbor');

    expect(screen.getByRole('note')).toHaveTextContent('read-only');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save policy' })).not.toBeInTheDocument();
    const managerRow = screen.getAllByRole('row', { name: /^Manager/ })[0];
    expect(managerRow).toBeDefined();
    expect(within(screen.getByRole('table')).getAllByText('$80.00').length).toBeGreaterThan(0);
  });

  it('points to categories when there are none', async () => {
    renderApp('/t/tnt_tidewater/policies', signedInAs(adminOf('tnt_tidewater')));
    expect(await screen.findByRole('link', { name: 'Create a category first' })).toHaveAttribute(
      'href',
      '/t/tnt_tidewater/categories',
    );
  });
});
