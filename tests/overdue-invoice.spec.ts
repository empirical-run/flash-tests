import { test, expect } from "./fixtures";
import { isPreviewEnvironment } from "./pages/urls";

test.describe("Overdue invoice warning", () => {
  test.skip(
    () => !isPreviewEnvironment(),
    "The overdue-invoice project and unpaid invoice are seeded on preview only",
  );
  test.use({ selectedProjectSlug: "overdue-invoice" });

  test("warning links to the overdue invoice", async ({ page }) => {
    await page.goto("/overdue-invoice/test-runs");

    await expect(
      page.getByText("An invoice on your account is 14 or more days overdue.", {
        exact: true,
      }),
    ).toBeVisible();

    await page.getByRole("link", { name: "View invoices" }).click();
    await expect(page).toHaveURL(/\/overdue-invoice\/settings\/billing\/?$/);
    await expect(
      page.getByRole("heading", { name: "Billing", exact: true, level: 1 }),
    ).toBeVisible();
    const invoice = page
      .getByRole("table")
      .getByRole("row")
      .filter({ hasText: "INV_TEST_OVERDUE_001" });
    await expect(invoice).toBeVisible();
    await expect(invoice.getByText("Overdue", { exact: true })).toBeVisible();
  });
});
