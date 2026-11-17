import { expect, test } from '@playwright/test';
import { nav, open, resetLiveApi } from './support';

const TEAM_CSV = [
  'name;email;role;costCenter',
  'Ana Lima;ana@lumio.example;director;OPS',
  'Bo Reis;bo@lumio.example;employee;SALES',
].join('\n');

test.beforeEach(async ({ request }) => {
  await resetLiveApi(request);
});

/**
 * The main flow, end to end on the production build (against the mock, or with
 * E2E_API=live against the Java tenant API): a Support Operator onboards a
 * tenant, its Program Admin tightens a policy, and a receipt is checked against it.
 */
test('onboard a tenant, edit its policy and check a receipt', async ({ page }) => {
  await open(page, '/');
  await expect(page.getByRole('heading', { level: 1, name: 'Tenants' })).toBeVisible();

  // Onboarding wizard.
  await nav(page).getByRole('link', { name: 'New tenant' }).click();
  await page.getByLabel('Company name').fill('Lumio Tours');
  await page.getByLabel('Country').selectOption({ label: 'Brazil' });
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByLabel('Currency', { exact: true })).toHaveValue('BRL');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Employee CSV file').setInputFiles({
    name: 'team.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(TEAM_CSV),
  });
  await expect(page.getByText(/2 valid, 0 with errors/)).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('2 to import')).toBeVisible();
  await page.getByRole('button', { name: 'Continue to provisioning' }).click();
  await page.getByRole('button', { name: 'Provision tenant' }).click();
  await expect(page.getByText('Lumio Tours is provisioned and active.')).toBeVisible();

  // The new tenant's Program Admin tightens the Meals limit for employees.
  await page.getByLabel('Signed in as').selectOption({ label: 'Program Admin · Lumio Tours' });
  await expect(page.getByRole('heading', { level: 1, name: 'Categories' })).toBeVisible();
  await nav(page).getByRole('link', { name: 'Policies' }).click();
  const limit = page.getByLabel('Limit, Meals, Employee');
  await expect(limit).toHaveValue('250.00');
  await limit.fill('80.00');
  // The receipt threshold can't sit above the limit (a domain rule), so lower it too.
  await page.getByLabel('Receipt required above, Meals, Employee').fill('50.00');
  await page.getByRole('button', { name: 'Save policy' }).click();
  await expect(page.getByText('Policy saved.')).toBeVisible();

  // A sample receipt is read (fixture), reviewed, and checked against the new limit.
  await nav(page).getByRole('link', { name: 'Receipts' }).click();
  await page.getByRole('button', { name: /Bakery breakfast/ }).click();
  const review = page.getByRole('form', { name: 'Expense review' });
  await expect(review.getByLabel(/Total/)).toHaveValue('86.40');
  await review.getByLabel('Spent by (employee role)').selectOption({ label: 'Employee' });
  const result = page.getByRole('region', { name: 'Policy check' });
  await expect(result.getByText('Violation')).toBeVisible();
  await expect(result.getByText('R$86.40 is above the R$80.00 limit.')).toBeVisible();

  // Every step left an audit trail.
  await nav(page).getByRole('link', { name: 'Audit log' }).click();
  await expect(page.getByRole('row', { name: /Policy updated/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /Employees imported/ })).toBeVisible();
});

test('keeps the signed-in persona across a reload', async ({ page }) => {
  await open(page, '/');
  await page
    .getByLabel('Signed in as')
    .selectOption({ label: 'Program Admin · Bluefin Logistics' });
  await expect(page.getByRole('heading', { level: 1, name: 'Categories' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Categories' })).toBeVisible();
  await expect(page.getByLabel('Signed in as')).toHaveValue('per_admin_tnt_bluefin');
});
