import { test, expect } from '@playwright/test';

test.describe('Category 3 — Broken Access Control & IDOR', () => {
  test.use({ storageState: 'playwright/.auth/customer.json' });

  test('Customer cannot access admin dashboard endpoints directly', async ({ page }) => {
    // Navigate to customer dashboard to ensure authenticated origin
    await page.goto('http://localhost:5173/customer/dashboard');

    // Retrieve customer token from local storage
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();

    // Call the admin dashboard API endpoint using fetch with the customer token
    const response = await page.evaluate(async (authToken) => {
      const res = await fetch('http://localhost:5000/api/admin/dashboard', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      return {
        status: res.status,
        body: await res.json().catch(() => ({}))
      };
    }, token);

    // Verify access control is enforced (should be 403, not 200 success)
    // Discovered from: missing require_role("admin") in backend/routers/admin.py
    expect(response.status).toBe(403);
  });
});
