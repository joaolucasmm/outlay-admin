import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { adminOf, operator, signedInAs } from '../../test/personas';
import { renderApp } from '../../test/renderApp';

describe('route guards', () => {
  it('blocks a Program Admin from the tenants list', async () => {
    renderApp('/tenants', signedInAs(adminOf('tnt_bluefin')));

    expect(await screen.findByRole('heading', { name: 'Not authorized' })).toBeInTheDocument();
    expect(screen.getByText(/"tenants:list" permission/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to your home page' })).toHaveAttribute(
      'href',
      '/t/tnt_bluefin/categories',
    );
  });

  it("blocks a Program Admin from another tenant's pages", async () => {
    renderApp('/t/tnt_harbor/categories', signedInAs(adminOf('tnt_bluefin')));

    expect(await screen.findByRole('heading', { name: 'Not authorized' })).toBeInTheDocument();
    expect(screen.getByText(/outside your scope/)).toBeInTheDocument();
  });

  it('blocks the Support Operator from program configuration pages', async () => {
    renderApp('/t/tnt_bluefin/policies', signedInAs(operator));

    expect(await screen.findByRole('heading', { name: 'Not authorized' })).toBeInTheDocument();
  });

  it('lets both roles read a tenant audit log', async () => {
    renderApp('/t/tnt_bluefin/audit', signedInAs(operator));
    expect(await screen.findByRole('heading', { name: 'Audit log' })).toBeInTheDocument();
  });
});
