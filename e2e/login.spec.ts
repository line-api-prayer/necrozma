import { test, expect } from '@playwright/test';

test.describe('Login & Redirection', () => {
  test('should display test login options and redirect to admin dashboard when Admin test login is clicked', async ({ page }) => {
    // 1. Visit Login Page
    await page.goto('/login');

    // 2. Wait for UI to load (Thai heading)
    await expect(page.getByRole('heading', { name: "ฝากใส่บาตร" })).toBeVisible();

    // 3. Since we are in development, the test accounts button should exist
    const adminLoginBtn = page.getByRole('button', { name: "Test Admin" });
    await expect(adminLoginBtn).toBeVisible();

    // 4. Click it to trigger autofill, then click submit
    await adminLoginBtn.click();
    await page.getByRole('button', { name: "เข้าสู่ระบบ", exact: true }).click();

    // 5. It should push us to the Admin dashboard
    await expect(page).toHaveURL(/.*\/admin/, { timeout: 30000 });
  });

  test('should redirect to staff dashboard when Staff test login is clicked', async ({ page }) => {
    // 1. Visit Login Page
    await page.goto('/login');

    // 2. Click staff login and submit
    const staffLoginBtn = page.getByRole('button', { name: "Test Staff" });
    await expect(staffLoginBtn).toBeVisible();
    await staffLoginBtn.click();
    await page.getByRole('button', { name: "เข้าสู่ระบบ", exact: true }).click();

    // 3. It should push us to the Staff dashboard
    await expect(page).toHaveURL(/.*\/staff/, { timeout: 30000 });
  });
});
