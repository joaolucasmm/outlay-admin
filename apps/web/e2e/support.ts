import { expect, type Page } from '@playwright/test';

export const OPERATOR = {
  id: 'per_operator',
  label: 'Support Operator',
  role: 'support_operator',
  tenantId: null,
} as const;

export const adminOf = (tenantId: string, name: string) => ({
  id: `per_admin_${tenantId}`,
  label: `Program Admin · ${name}`,
  role: 'program_admin' as const,
  tenantId,
});

type Persona = typeof OPERATOR | ReturnType<typeof adminOf>;

/** Starts signed in as `persona` (the app restores its session from localStorage). */
export async function signInAs(page: Page, persona: Persona) {
  await page.addInitScript(
    (session) => {
      window.localStorage.setItem('outlay-admin:session:v1', JSON.stringify(session));
    },
    { persona, currentTenantId: persona.tenantId },
  );
}

/** Opens a route of the app (relative to the /outlay-admin/ base) once the mock API is up. */
export async function open(page: Page, path: string) {
  await page.goto(path.replace(/^\//, ''));
  await expect(page.getByText('Mock API: ok')).toBeVisible();
}

export const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' });
