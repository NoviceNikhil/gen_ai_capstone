import { test, expect } from '@playwright/test';

test.describe('Admin Platform Management', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test.beforeEach(async ({ page }) => {
    // Intercept profile and dashboard API
    await page.route('**/auth/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: "success",
          data: {
            id: "admin_id",
            full_name: "Admin Operations",
            email: "nikhilchathapuram@gmail.com",
            phone: "+91 98765 41999",
            role: "admin",
            is_active: true
          }
        }),
      });
    });

    await page.route('**/api/admin/dashboard', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: "success",
          data: {
            stats: {
              total_revenue: 125000,
              active_users: 124,
              active_providers: 10,
              live_bookings: 18
            }
          }
        }),
      });
    });
  });

  test('Navigate admin dashboard and verify widgets', async ({ page }) => {
    // AdminDashboard
    // http://localhost:5173/admin/dashboard
    // e18, e22
    await page.goto('http://localhost:5173/admin/dashboard');
    await expect(page.getByRole('heading', { name: 'System Overview' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'APPOINTMENT STATUS MIX' })).toBeVisible();
  });
});
