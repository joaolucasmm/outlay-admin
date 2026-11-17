import { expect, type APIRequestContext, type Page } from '@playwright/test';

/** `E2E_API=live`: the app talks to the Java tenant API instead of the MSW mock. */
export const LIVE = process.env.E2E_API === 'live';
const LIVE_API_URL = 'http://localhost:8080/api/v1';

/** Live mode shares one database: put the demo data back before each test. */
export async function resetLiveApi(request: APIRequestContext) {
  if (!LIVE) return;
  const response = await request.post(`${LIVE_API_URL}/demo/reset`);
  expect(response.status()).toBe(204);
}

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

/** Opens a route of the app (relative to the /outlay-admin/ base) once the API is up. */
export async function open(page: Page, path: string) {
  await page.goto(path.replace(/^\//, ''));
  await expect(page.getByText(LIVE ? 'Live API: ok' : 'Mock API: ok')).toBeVisible();
}

export const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' });
