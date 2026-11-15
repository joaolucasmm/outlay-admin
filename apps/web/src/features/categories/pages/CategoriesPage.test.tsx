import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { db } from '../../../mocks/db';
import { server } from '../../../mocks/node';
import { adminOf, signedInAs } from '../../../test/personas';
import { renderApp } from '../../../test/renderApp';

const renderCategories = async (tenantId = 'tnt_bluefin') => {
  const utils = renderApp(`/t/${tenantId}/categories`, signedInAs(adminOf(tenantId)));
  await screen.findByRole('heading', { name: 'Categories' });
  return { ...utils, user: userEvent.setup() };
};

const rowFor = (name: string) => screen.getByRole('row', { name: new RegExp(name) });

describe('CategoriesPage', () => {
  it('lists the categories with their status', async () => {
    await renderCategories();

    const table = await screen.findByRole('table', { name: 'Categories' });
    expect(within(table).getAllByRole('row')).toHaveLength(7);
    expect(screen.getByRole('switch', { name: 'Meals active' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Software subscriptions active' })).not.toBeChecked();
  });

  it('creates a category, validating the code first', async () => {
    const { user } = await renderCategories();
    await screen.findByRole('table', { name: 'Categories' });

    await user.click(screen.getByRole('button', { name: 'New category' }));
    const dialog = screen.getByRole('dialog', { name: 'New category' });
    await user.type(within(dialog).getByLabelText('Code'), 'training');
    await user.type(within(dialog).getByLabelText('Name'), 'Training');
    await user.click(within(dialog).getByRole('button', { name: 'Create category' }));
    expect(await within(dialog).findByText(/capital letters/)).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText('Code'));
    await user.type(within(dialog).getByLabelText('Code'), 'TRAINING');
    await user.click(within(dialog).getByRole('button', { name: 'Create category' }));

    expect(await screen.findByText('Training created.')).toBeInTheDocument();
    expect(await screen.findByRole('switch', { name: 'Training active' })).toBeChecked();
  });

  it('shows a duplicate code from the server next to the field', async () => {
    const { user } = await renderCategories();
    await screen.findByRole('table', { name: 'Categories' });

    await user.click(screen.getByRole('button', { name: 'New category' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Code'), 'MEALS');
    await user.type(within(dialog).getByLabelText('Name'), 'More meals');
    await user.click(within(dialog).getByRole('button', { name: 'Create category' }));

    expect(await within(dialog).findByText('The code MEALS is already used.')).toBeInTheDocument();
  });

  it('renames a category; the code stays locked', async () => {
    const { user } = await renderCategories();
    await screen.findByRole('table', { name: 'Categories' });

    await user.click(screen.getByRole('button', { name: 'Edit Meals' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit Meals' });
    expect(within(dialog).getByLabelText('Code')).toBeDisabled();
    await user.clear(within(dialog).getByLabelText('Name'));
    await user.type(within(dialog).getByLabelText('Name'), 'Meals & drinks');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Meals & drinks saved.')).toBeInTheDocument();
    expect(
      await within(rowFor('MEALS')).findByRole('button', { name: 'Edit Meals & drinks' }),
    ).toBeInTheDocument();
  });

  it('toggles a category optimistically', async () => {
    const { user } = await renderCategories();
    const toggle = await screen.findByRole('switch', { name: 'Meals active' });

    await user.click(toggle);

    expect(toggle).not.toBeChecked();
    await waitFor(() => {
      expect(db.categories('tnt_bluefin').find((c) => c.code === 'MEALS')?.active).toBe(false);
    });
  });

  it('rolls the toggle back when the server fails', async () => {
    let release: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.patch('*/api/v1/tenants/:tenantId/categories/:categoryId', async () => {
        await pending;
        return HttpResponse.json(
          { type: 'about:blank', title: 'Server error', status: 500, detail: 'Database is down.' },
          { status: 500 },
        );
      }),
    );
    const { user } = await renderCategories();
    const toggle = await screen.findByRole('switch', { name: 'Meals active' });

    await user.click(toggle);
    expect(toggle).not.toBeChecked(); // optimistic
    release();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not deactivate Meals: Database is down. The change was undone.',
    );
    expect(toggle).toBeChecked();
  });

  it('is read-only for a suspended tenant', async () => {
    await renderCategories('tnt_harbor');

    expect(await screen.findByRole('note')).toHaveTextContent(
      'Harbor Health Group is suspended. Its expense program is read-only',
    );
    expect(await screen.findByRole('switch', { name: 'Meals active' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'New category' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit Meals' })).toBeDisabled();
  });

  it('shows an empty state when the tenant has no categories', async () => {
    await renderCategories('tnt_tidewater');
    expect(await screen.findByText('No categories yet.')).toBeInTheDocument();
  });

  it('shows an error state with a retry', async () => {
    server.use(
      http.get('*/api/v1/tenants/:tenantId/categories', () =>
        HttpResponse.json({ type: 'about:blank', title: 'Boom', status: 500 }, { status: 500 }),
      ),
    );
    const { user } = await renderCategories();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load categories.');
    server.resetHandlers();
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('table', { name: 'Categories' })).toBeInTheDocument();
  });
});
