import { expect, test } from '@playwright/test';
import { adminOf, open, signInAs } from './support';

test('the skip link is the first stop and moves focus to the main content', async ({ page }) => {
  await open(page, '/tenants');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible(); // visible once focused

  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});

test('dialogs trap focus, close on Escape and return focus to their trigger', async ({ page }) => {
  await open(page, '/tenants');
  const trigger = page.getByRole('button', { name: 'Suspend Bluefin Logistics' });
  await trigger.focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Suspend Bluefin Logistics?' });
  await expect(dialog).toBeVisible();
  // Tabbing many times never leaves the dialog.
  for (let i = 0; i < 8; i += 1) await page.keyboard.press('Tab');
  await expect(dialog.locator(':focus')).toHaveCount(1);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('a lifecycle action can be completed with the keyboard only', async ({ page }) => {
  await open(page, '/tenants');
  await page.getByRole('button', { name: 'Suspend Bluefin Logistics' }).focus();
  await page.keyboard.press('Enter');
  // The dialog moves focus into its first field on its own.
  await expect(page.getByRole('dialog').getByLabel('Reason')).toBeFocused();
  await page.keyboard.type('Keyboard-only check');
  await page.getByRole('dialog').getByRole('button', { name: 'Suspend' }).focus();
  await page.keyboard.press('Enter');

  await expect(page.getByText('Bluefin Logistics suspended.')).toBeVisible();
});

test('the policy grid can be edited and saved from the keyboard', async ({ page }) => {
  await signInAs(page, adminOf('tnt_bluefin', 'Bluefin Logistics'));
  await open(page, '/t/tnt_bluefin/policies');
  const limit = page.getByLabel('Limit, Meals, Manager');
  await limit.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('410');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Receipt required above, Meals, Manager')).toBeFocused();

  await page.getByRole('button', { name: 'Save policy' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Policy saved.')).toBeVisible();
});
