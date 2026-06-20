import { expect, test } from '@playwright/test';

test('serves the local health endpoint', async ({ request }) => {
  const response = await request.get('/api/health');

  expect(response.ok()).toBe(true);
  await expect(response).toBeOK();
  expect(response.headers()['content-type']).toContain('application/json');

  const body = await response.json();
  expect(body).toMatchObject({
    status: 'ok',
    app: 'DocVault',
  });
});

test('renders the login screen', async ({ page }) => {
  await page.goto('/login');

  await expect(page).toHaveTitle(/DocVault/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with SSO' })).toBeVisible();
  await expect(page.getByText('Use your Keycloak credentials')).toBeVisible();
});
