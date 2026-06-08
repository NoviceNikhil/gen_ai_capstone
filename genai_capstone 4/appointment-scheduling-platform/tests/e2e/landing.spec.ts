import { test, expect } from '@playwright/test';

test.describe('Landing Page Features', () => {
  test.beforeEach(async ({ page }) => {
    // LandingPage
    // http://localhost:5173/
    await page.goto('http://localhost:5173/');
  });

  test('Verify landing page components', async ({ page }) => {
    // LandingPage
    // Heading & category links
    // e5, e21-e26
    await expect(page.getByRole('heading', { name: 'The New Standard in Modern Scheduling.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Healthcare' })).toBeVisible();
  });

  test('Interactive Step Visualizer', async ({ page }) => {
    // LandingPage
    // Three steps selector
    // e14, e15, e16, e17
    await page.getByRole('heading', { name: '2. Select Perfect Slot' }).click();
    await expect(page.getByText('Select Appointment Slot')).toBeVisible();
  });

  test('FAQ accordion opens on click', async ({ page }) => {
    // LandingPage
    // FAQ toggles
    // e35, e36, e37
    await page.getByRole('button', { name: 'How does the instant vetting conflict system work?' }).click();
    await expect(page.getByText(/Appointly acts as a continuous state-machine/)).toBeVisible();
  });
});
