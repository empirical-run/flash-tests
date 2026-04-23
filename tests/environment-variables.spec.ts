import { test, expect } from "./fixtures";

test.describe("Environment Variables", () => {
  test("navigate to environment variables settings and verify page loads", async ({ page }) => {
    await page.goto("/");

    // Navigate to Settings → Environment Variables
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("link", { name: "Environment Variables" }).click();

    // Verify the page heading is visible
    await expect(
      page.getByRole("heading", { name: "Environment Variables" })
    ).toBeVisible();

    // Verify the "Add Variable" (or similar) button is present
    await expect(
      page.getByRole("button", { name: /Add/i })
    ).toBeVisible();
  });
});
