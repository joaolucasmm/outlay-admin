import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { adminOf, OPERATOR, open, signInAs } from './support';

const BLUEFIN = adminOf('tnt_bluefin', 'Bluefin Logistics');

/** WCAG 2.1 A/AA rules; serious and critical violations fail the test. */
async function expectNoSeriousViolations(page: Page, context: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const serious = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({
      rule: v.id,
      impact: v.impact,
      help: v.help,
      targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
    }));
  expect(serious, `${context}: ${JSON.stringify(serious, null, 2)}`).toEqual([]);
}

test.describe('as the Support Operator', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, OPERATOR);
  });

  test('tenants and a lifecycle dialog', async ({ page }) => {
    await open(page, '/tenants');
    await expect(page.getByRole('table', { name: 'Tenants' })).toBeVisible();
    await expectNoSeriousViolations(page, 'tenants');

    await page.getByRole('button', { name: 'Suspend Bluefin Logistics' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectNoSeriousViolations(page, 'suspend dialog');
  });

  test('onboarding wizard', async ({ page }) => {
    await open(page, '/tenants/new');
    await expect(page.getByLabel('Company name')).toBeVisible();
    await expectNoSeriousViolations(page, 'wizard: company');
  });

  test('audit log and its changes drawer', async ({ page }) => {
    await open(page, '/t/tnt_harbor/audit');
    await expect(page.getByRole('table', { name: 'Audit events' })).toBeVisible();
    await expectNoSeriousViolations(page, 'audit');

    await page
      .getByRole('button', { name: /View changes/ })
      .first()
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectNoSeriousViolations(page, 'audit drawer');
  });
});

test.describe('as a Program Admin', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, BLUEFIN);
  });

  test('categories and the new category dialog', async ({ page }) => {
    await open(page, '/t/tnt_bluefin/categories');
    await expect(page.getByRole('table', { name: 'Categories' })).toBeVisible();
    await expectNoSeriousViolations(page, 'categories');

    await page.getByRole('button', { name: 'New category' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectNoSeriousViolations(page, 'new category dialog');
  });

  test('policy grid', async ({ page }) => {
    await open(page, '/t/tnt_bluefin/policies');
    await expect(page.getByRole('table', { name: /Policy grid/ })).toBeVisible();
    await expectNoSeriousViolations(page, 'policies');
  });

  test('employees and the import dialog', async ({ page }) => {
    await open(page, '/t/tnt_bluefin/employees');
    await expect(page.getByRole('table', { name: 'Employees' })).toBeVisible();
    await expectNoSeriousViolations(page, 'employees');

    await page.getByRole('button', { name: 'Import CSV' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectNoSeriousViolations(page, 'import dialog');
  });

  test('receipts with a reviewed sample', async ({ page }) => {
    await open(page, '/t/tnt_bluefin/receipts');
    await page.getByRole('button', { name: /Bakery breakfast/ }).click();
    await expect(page.getByRole('form', { name: 'Expense review' })).toBeVisible();
    await expectNoSeriousViolations(page, 'receipts');
  });

  test('a read-only (suspended) tenant', async ({ page }) => {
    await signInAs(page, adminOf('tnt_harbor', 'Harbor Health Group'));
    await open(page, '/t/tnt_harbor/policies');
    await expect(page.getByRole('note')).toBeVisible();
    await expectNoSeriousViolations(page, 'read-only policies');
  });
});
