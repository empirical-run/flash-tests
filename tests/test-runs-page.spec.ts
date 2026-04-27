import { test, expect } from "./fixtures";

test.describe("Test Runs Page", () => {
  test("navigates to test runs page and shows runs list", async ({ page }) => {
    await page.goto("/");

    // Navigate to Test Runs via the sidebar
    await page.getByRole("link", { name: "Test Runs" }).click();

    // Verify the URL contains "test-runs"
    await expect(page).toHaveURL(/test-runs/);

    // Verify the page heading is visible
    await expect(
      page.getByRole("heading", { name: "Test Runs" })
    ).toBeVisible();

    // Verify at least one test run row is rendered in the list
    await expect(page.locator("table tbody tr").first()).toBeVisible();
  });
});
