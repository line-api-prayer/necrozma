import { expect, test } from "@playwright/test";

test.describe("Login", () => {
  test("shows the local test-login shortcuts and autofills admin credentials", async ({
    page,
  }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: "ฝากใส่บาตร" }),
    ).toBeVisible();

    const adminLoginBtn = page.getByRole("button", { name: "Test Admin" });
    await expect(adminLoginBtn).toBeVisible();
    await adminLoginBtn.click();

    await expect(page.getByLabel("อีเมล")).toHaveValue("admin@test.com");
    await expect(page.getByLabel("รหัสผ่าน")).toHaveValue("password123");
  });

  test("shows the banned-account message from the callback search param", async ({
    page,
  }) => {
    await page.goto("/login?error=banned");

    await expect(
      page.getByText(
        "บัญชีของคุณถูกระงับ หรืออยู่ระหว่างรอการอนุมัติจากแอดมิน",
      ),
    ).toBeVisible();
  });

  test("shows the local test-login shortcuts and autofills staff credentials", async ({
    page,
  }) => {
    await page.goto("/login");

    const staffLoginBtn = page.getByRole("button", { name: "Test Staff" });
    await expect(staffLoginBtn).toBeVisible();
    await staffLoginBtn.click();

    await expect(page.getByLabel("อีเมล")).toHaveValue("staff@test.com");
    await expect(page.getByLabel("รหัสผ่าน")).toHaveValue("password123");
  });
});
