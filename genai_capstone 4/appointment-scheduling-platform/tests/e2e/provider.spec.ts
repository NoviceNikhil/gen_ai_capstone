import { test, expect } from '@playwright/test';

test.describe('Provider Dashboard and Management', () => {
  test.use({ storageState: 'playwright/.auth/provider.json' });

  test('Navigate dashboard and view appointments queue', async ({ page }) => {
    // ProviderDashboard
    // http://localhost:5173/provider/dashboard
    // e17, e31
    await page.goto('http://localhost:5173/provider/dashboard');
    await expect(page.getByRole('heading', { name: 'Provider Dashboard' })).toBeVisible();

    // Navigate to queue
    await page.getByRole('link', { name: /PENDING DECISIONS/ }).click();
    await expect(page).toHaveURL('http://localhost:5173/provider/appointments');
  });

  test('View service configurations', async ({ page }) => {
    // ProviderServices
    // http://localhost:5173/provider/services
    // e17, e18
    await page.goto('http://localhost:5173/provider/services');
    await expect(page.getByRole('heading', { name: 'Service Package Manager' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Initial Consultation' })).toBeVisible();
  });
});
