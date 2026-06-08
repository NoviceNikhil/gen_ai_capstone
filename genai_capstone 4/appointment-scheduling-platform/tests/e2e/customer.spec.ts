import { test, expect } from '@playwright/test';

test.describe('Customer Dashboard and Marketplace', () => {
  test.use({ storageState: 'playwright/.auth/customer.json' });

  test('Navigate dashboard and browse marketplace', async ({ page }) => {
    // CustomerDashboard
    // http://localhost:5173/customer/dashboard
    // e14, e19
    await page.goto('http://localhost:5173/customer/dashboard');
    await expect(page.getByRole('heading', { name: /Hello, Neha/ })).toBeVisible();

    // Click Browse Marketplace to navigate
    await page.getByRole('button', { name: 'Browse Marketplace' }).click();
    await expect(page).toHaveURL('http://localhost:5173/customer/providers');
  });

  test('Filter marketplace by Healthcare category', async ({ page }) => {
    // ProviderList
    // http://localhost:5173/customer/providers
    // e19
    await page.goto('http://localhost:5173/customer/providers');
    
    // Filter to Healthcare category
    await page.getByRole('button', { name: 'Healthcare' }).click();
    await expect(page.getByText('Dr. Aisha Mehta')).toBeVisible();
    await expect(page.getByText('Kavya Nair')).not.toBeVisible();
  });
});
