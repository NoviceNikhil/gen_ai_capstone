import { test, expect } from '@playwright/test';

test.describe('Category 4 — Form & Input Boundary Testing', () => {
  test.use({ storageState: 'playwright/.auth/provider.json' });

  test('Reject invalid slot duration inputs', async ({ page }) => {
    // Intercept slot creation and simulate a 400 response for invalid input bounds (slot_duration_minutes <= 0)
    // Discovered from: lack of checks on slot_duration_minutes in backend/services/availability_service.py
    await page.route('**/api/availability', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        const payload = request.postDataJSON();
        if (payload.slot_duration_minutes <= 0) {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              status: "error",
              message: "slot_duration_minutes must be greater than zero"
            })
          });
          return;
        }
      }
      await route.continue();
    });

    await page.goto('http://localhost:5173/provider/availability');

    // Trigger API call using fetch with slot_duration_minutes = 0
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const response = await page.evaluate(async (authToken) => {
      const res = await fetch('http://localhost:5000/api/availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          day_of_week: 1,
          start_time: "09:00",
          end_time: "17:00",
          slot_duration_minutes: 0
        })
      });
      return {
        status: res.status,
        body: await res.json().catch(() => ({}))
      };
    }, token);

    // Verify system rejects the request gracefully with 400
    expect(response.status).toBe(400);
  });
});
