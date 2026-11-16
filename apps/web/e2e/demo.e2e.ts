import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { nav, open } from './support';

/**
 * Captures the frames of the README demo GIF. Skipped unless CAPTURE_DEMO=1:
 *   CAPTURE_DEMO=1 pnpm --filter web exec playwright test demo
 * then assemble them with scripts/make_demo_gif.py.
 */
const FRAMES = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docs/media/frames',
);

test.skip(!process.env.CAPTURE_DEMO, 'Only when capturing the README demo (CAPTURE_DEMO=1).');
test.use({ viewport: { width: 1280, height: 800 } });

let frame = 0;
const shoot = async (page: Page) => {
  frame += 1;
  await page.mouse.move(0, 0);
  await page.screenshot({ path: path.join(FRAMES, `${String(frame).padStart(2, '0')}.png`) });
};

test('demo frames', async ({ page }) => {
  await open(page, '/');
  await expect(page.getByRole('table', { name: 'Tenants' })).toBeVisible();
  await shoot(page);

  await nav(page).getByRole('link', { name: 'New tenant' }).click();
  await page.getByLabel('Company name').fill('Lumio Tours');
  await page.getByLabel('Country').selectOption({ label: 'Brazil' });
  await shoot(page);
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Employee CSV file').setInputFiles({
    name: 'lumio-team.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      [
        'name;email;role;costCenter',
        'Ana Lima;ana@lumio.example;director;OPS',
        'Bo Reis;bo@lumio.example;employee;SALES',
        'Cris Neves;cris@lumio;manager;OPS',
      ].join('\n'),
    ),
  });
  await expect(page.getByText(/2 valid, 1 with errors/)).toBeVisible();
  await shoot(page);
  await page.getByLabel(/Skip the 1 row/).check();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Continue to provisioning' }).click();
  await page.getByRole('button', { name: 'Provision tenant' }).click();
  await expect(page.getByText('Lumio Tours is provisioned and active.')).toBeVisible();
  await shoot(page);

  await page.getByLabel('Signed in as').selectOption({ label: 'Program Admin · Lumio Tours' });
  await nav(page).getByRole('link', { name: 'Policies' }).click();
  await page.getByLabel('Limit, Meals, Employee').fill('80.00');
  await page.getByLabel('Receipt required above, Meals, Employee').fill('50.00');
  await page.getByLabel('Limit, Meals, Employee').focus();
  await shoot(page);
  await page.getByRole('button', { name: 'Save policy' }).click();
  await expect(page.getByText('Policy saved.')).toBeVisible();

  await nav(page).getByRole('link', { name: 'Receipts' }).click();
  await page.getByRole('button', { name: /Bakery breakfast/ }).click();
  const review = page.getByRole('form', { name: 'Expense review' });
  await expect(review.getByLabel(/Total/)).toHaveValue('86.40');
  await review.getByLabel('Spent by (employee role)').selectOption({ label: 'Employee' });
  await expect(page.getByText('R$86.40 is above the R$80.00 limit.')).toBeVisible();
  await shoot(page);

  await nav(page).getByRole('link', { name: 'Audit log' }).click();
  await page.getByRole('button', { name: /View changes of Policy updated/ }).click();
  await expect(page.getByRole('dialog', { name: 'Policy updated' })).toBeVisible();
  await shoot(page);
});
