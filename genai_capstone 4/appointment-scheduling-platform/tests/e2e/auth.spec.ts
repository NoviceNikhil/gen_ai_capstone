import { test, expect } from '@playwright/test';

test.describe('Authentication Flows', () => {
  test('Login validation errors', async ({ page }) => {
    // Login Component
    // handleSubmit
    // e8
    // http://localhost:5173/login
    await page.goto('http://localhost:5173/login');
    await page.getByRole('button', { name: 'Sign In to Appointly' }).click();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('Signup validation errors', async ({ page }) => {
    // Signup Component
    // handleSubmit
    // http://localhost:5173/signup
    await page.goto('http://localhost:5173/signup');
    // Register button click without credentials
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});
