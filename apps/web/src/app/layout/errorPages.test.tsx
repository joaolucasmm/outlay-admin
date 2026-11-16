import { render, screen, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { server } from '../../mocks/node';
import { renderApp } from '../../test/renderApp';
import { RouteErrorPage } from './RouteErrorPage';

function Boom(): never {
  throw new Error('render failed');
}

describe('error and not-found pages', () => {
  it('turns a crashing page into a readable error with a way out', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const router = createMemoryRouter([
      { path: '/', element: <Boom />, errorElement: <RouteErrorPage /> },
    ]);
    render(<RouterProvider router={router} />);

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
    expect(within(alert).getByRole('button', { name: 'Reload' })).toBeVisible();
    expect(within(alert).getByRole('link', { name: 'Go to your home page' })).toHaveAttribute(
      'href',
      '/',
    );
    consoleError.mockRestore();
  });

  it('shows a 404 inside the layout, linking to the persona home', async () => {
    renderApp('/no/such/page');

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Go to your home page' })).toHaveAttribute(
      'href',
      '/tenants',
    );
  });

  it('tells the operator when the tenant list is still loading or failed', async () => {
    server.use(
      http.get('*/api/v1/tenants', async () => {
        await delay(50);
        return HttpResponse.json(
          { type: 'about:blank', title: 'Boom', status: 500 },
          { status: 500 },
        );
      }),
    );
    renderApp('/tenants');

    const select = screen.getByLabelText('Viewing tenant');
    expect(select).toBeDisabled();
    expect(within(select).getByRole('option', { name: 'Loading tenants…' })).toBeInTheDocument();
    expect(
      await within(select).findByRole('option', { name: 'Could not load tenants' }),
    ).toBeInTheDocument();
    expect(select).toBeDisabled();
  });
});
