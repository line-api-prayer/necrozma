import { expect, test } from "@playwright/test";

test.describe("Service Request", () => {
  test("shows the invalid-link state for unsigned requests", async ({
    page,
  }) => {
    await page.goto("/service-request/ORDER-001?token=invalid");

    await expect(
      page.getByRole("heading", { name: "ลิงก์นี้ไม่ถูกต้องหรือหมดอายุ" }),
    ).toBeVisible();
    await expect(
      page.getByText("รบกวนขอรับลิงก์ใหม่จาก LINE OA แล้วลองเปิดอีกครั้งนะคะ"),
    ).toBeVisible();
  });
});
