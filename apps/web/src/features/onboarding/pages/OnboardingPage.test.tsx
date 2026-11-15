import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { db } from '../../../mocks/db';
import { server } from '../../../mocks/node';
import { renderApp } from '../../../test/renderApp';
import { initialOnboardingState, type OnboardingState } from '../onboardingSlice';

const CSV =
  'name,email,role,costCenter\n' +
  'Ana Rail,ana@acmerail.example,director,OPS\n' +
  'Bo Rail,bo@acmerail.example,employee,SALES\n' +
  'Broken,broken,ceo,OPS\n';

const fillCompany = async (user: ReturnType<typeof userEvent.setup>, name = 'Acme Rail') => {
  await user.type(await screen.findByLabelText('Company name'), name);
  await user.selectOptions(screen.getByLabelText('Country'), 'Brazil');
  await user.click(screen.getByRole('button', { name: 'Next' }));
};

/** Company → Locale → Employees (with one bad row) → Review → Provision. */
const walkToProvision = async (user: ReturnType<typeof userEvent.setup>) => {
  await fillCompany(user);
  expect(await screen.findByLabelText('Currency')).toHaveValue('BRL');
  await user.click(screen.getByRole('button', { name: 'Next' }));

  await user.upload(
    await screen.findByLabelText('Employee CSV file'),
    new File([CSV], 'acme.csv', { type: 'text/csv' }),
  );
  expect(await screen.findByText(/2 valid, 1 with errors/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Next' }));
  expect(screen.getByRole('alert')).toHaveTextContent('confirm that the rows with errors');
  await user.click(screen.getByLabelText(/Skip the 1 row with errors/));
  await user.click(screen.getByRole('button', { name: 'Next' }));

  const review = await screen.findByRole('region', { name: 'Review' });
  expect(within(review).getByText('Acme Rail')).toBeInTheDocument();
  expect(within(review).getByText('2 to import')).toBeInTheDocument();
  expect(within(review).getByText('(1 rows skipped)')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Continue to provisioning' }));
  await screen.findByRole('list', { name: 'Provisioning progress' });
};

const acme = () => db.tenants().filter((t) => t.name === 'Acme Rail');

describe('Onboarding wizard', () => {
  it('provisions a tenant end to end', async () => {
    const user = userEvent.setup();
    const { router, store } = renderApp('/tenants/new');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/tenants/new/company');
    });

    await walkToProvision(user);
    await user.click(screen.getByRole('button', { name: 'Provision tenant' }));

    expect(await screen.findByText('Acme Rail is provisioned and active.')).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Provisioning progress' })).getAllByText('Done'),
    ).toHaveLength(4);
    const [tenant] = acme();
    expect(tenant?.status).toBe('active');
    expect(tenant?.currency).toBe('BRL');
    expect(db.categories(tenant?.id ?? '')).toHaveLength(6);
    expect(db.employees(tenant?.id ?? '').map((e) => e.email)).toEqual([
      'ana@acmerail.example',
      'bo@acmerail.example',
    ]);
    // The new tenant's admin can sign in, and the tenant is listed.
    expect(
      await screen.findByRole('option', { name: 'Program Admin · Acme Rail' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Go to tenants' }));
    expect(router.state.location.pathname).toBe('/tenants');

    // Opening the wizard again starts a fresh draft.
    const nav = screen.getByRole('navigation', { name: 'Main' });
    await user.click(within(nav).getByRole('link', { name: 'New tenant' }));
    expect(await screen.findByLabelText('Company name')).toHaveValue('');
    expect(store.getState().onboarding).toEqual(initialOnboardingState);
  });

  it('resumes a failed provisioning without creating the tenant twice', async () => {
    let failActivate = true;
    server.use(
      http.post('*/api/v1/tenants/:tenantId/transitions', () => {
        if (!failActivate) return undefined; // fall through to the real mock handler
        return HttpResponse.json(
          { type: 'about:blank', title: 'Unavailable', status: 503, detail: 'Try again later.' },
          { status: 503 },
        );
      }),
    );
    const user = userEvent.setup();
    const { router } = renderApp('/tenants/new');
    await walkToProvision(user);

    await user.click(screen.getByRole('button', { name: 'Provision tenant' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '“Activate the tenant” failed: Try again later.',
    );
    expect(acme()).toMatchObject([{ status: 'provisioning' }]);
    // Once the tenant exists, the earlier steps are locked.
    const nav = screen.getByRole('navigation', { name: 'Main' });
    await user.click(within(nav).getByRole('link', { name: 'New tenant' }));
    expect(router.state.location.pathname).toBe('/tenants/new/provision');

    failActivate = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Acme Rail is provisioned and active.')).toBeInTheDocument();
    expect(acme()).toHaveLength(1);
    expect(acme()[0]?.status).toBe('active');
  });

  it('warns about a name that is already taken', async () => {
    const user = userEvent.setup();
    renderApp('/tenants/new/company');
    await fillCompany(user, 'bluefin logistics');
    expect(await screen.findByText('A tenant with this name already exists.')).toBeInTheDocument();
  });

  it('validates the company step', async () => {
    const user = userEvent.setup();
    renderApp('/tenants/new/company');
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    expect(
      await screen.findByText('Enter a company name of 2 to 80 characters.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Choose a supported country.')).toBeInTheDocument();
  });

  it('sends a deep link to the first incomplete step', async () => {
    const { router } = renderApp('/tenants/new/review');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/tenants/new/company');
    });
  });

  it('continues a saved draft where it stopped', async () => {
    const draft: OnboardingState = {
      ...initialOnboardingState,
      company: { name: 'Draft Co', country: 'MX' },
      locale: { currency: 'MXN', templateId: 'empty' },
    };
    const { router } = renderApp('/tenants/new', { onboarding: draft });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/tenants/new/employees');
    });
    expect(screen.getByRole('link', { name: /Company \(completed\)/ })).toBeInTheDocument();
  });

  it('discards a draft after confirmation', async () => {
    const user = userEvent.setup();
    const { store } = renderApp('/tenants/new', {
      onboarding: { ...initialOnboardingState, company: { name: 'Draft Co', country: 'MX' } },
    });
    await user.click(await screen.findByRole('button', { name: 'Discard draft' }));
    const dialog = screen.getByRole('dialog', { name: 'Discard this draft?' });
    await user.click(within(dialog).getByRole('button', { name: 'Discard draft' }));

    expect(store.getState().onboarding).toEqual(initialOnboardingState);
    expect(await screen.findByLabelText('Company name')).toHaveValue('');
  });
});
