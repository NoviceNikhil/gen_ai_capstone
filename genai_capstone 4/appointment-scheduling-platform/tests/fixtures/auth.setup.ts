import { test as setup, expect } from '@playwright/test';

const authDir = 'playwright/.auth';

setup('authenticate as customer', async ({ page }) => {
  // Login Page
  // loginUser
  // e4, e6, e8
  // http://localhost:5173/login
  await page.goto('http://localhost:5173/login');
  await page.getByPlaceholder('name@company.com').fill('neha.verma.customer@app-demo.com');
  await page.getByPlaceholder('••••••••••••').fill('Customer123');
  await page.getByRole('button', { name: 'Sign In to Appointly' }).click();
  await expect(page).toHaveURL('http://localhost:5173/customer/dashboard', { timeout: 15000 });
  await page.context().storageState({ path: `${authDir}/customer.json` });
});

setup('authenticate as provider', async ({ page }) => {
  // Login Page
  // loginUser
  // e4, e6, e8
  // http://localhost:5173/login
  await page.goto('http://localhost:5173/login');
  await page.getByPlaceholder('name@company.com').fill('aisha.mehta.provider@app-demo.com');
  await page.getByPlaceholder('••••••••••••').fill('Provider123');
  await page.getByRole('button', { name: 'Sign In to Appointly' }).click();
  await expect(page).toHaveURL('http://localhost:5173/provider/dashboard', { timeout: 15000 });
  await page.context().storageState({ path: `${authDir}/provider.json` });
});

setup('authenticate as admin', async ({ page }) => {
  // Intercept authentication API calls
  await page.route('**/auth/login', async (route) => {
    const postData = route.request().postDataJSON();
    if (postData.email === 'nikhilchathapuram@gmail.com') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: "success",
          data: {
            isAdmin: true,
            email: "nikhilchathapuram@gmail.com",
            message: "OTP sent to admin email"
          }
        }),
      });
    } else {
      await route.continue();
    }
  });

  await page.route('**/auth/verify-otp/admin', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: "success",
        data: {
          token: "mocked_admin_token",
          role: "admin",
          user: {
            id: "admin_id",
            full_name: "Admin Operations",
            email: "nikhilchathapuram@gmail.com",
            phone: "+91 98765 41999",
            role: "admin",
            is_active: true
          }
        }
      }),
    });
  });

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

  await page.goto('http://localhost:5173/login');
  await page.getByPlaceholder('name@company.com').fill('nikhilchathapuram@gmail.com');
  await page.getByPlaceholder('••••••••••••').fill('Admin123');
  await page.getByRole('button', { name: 'Sign In to Appointly' }).click();
  await expect(page).toHaveURL('http://localhost:5173/verify-otp', { timeout: 15000 });

  const inputs = page.locator('input[type="text"]');
  for (let i = 0; i < 6; i++) {
    await inputs.nth(i).fill('8');
  }
  await page.getByRole('button', { name: 'Verify Code' }).click();
  await expect(page).toHaveURL('http://localhost:5173/admin/dashboard', { timeout: 15000 });
  await page.context().storageState({ path: `${authDir}/admin.json` });
});
