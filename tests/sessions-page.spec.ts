import { test, expect } from "./fixtures";

test.describe("Sessions Page", () => {
  test("navigates to sessions page and shows new session button", async ({ page }) => {
    await page.goto("/");

    // Navigate to Sessions via the sidebar link
    await page.getByRole("link", { name: "Sessions" }).click();

    // Verify the page heading is visible
    await expect(page.getByRole("heading", { name: "Sessions" })).toBeVisible();

    // Verify the "New Session" button is present
    await expect(
      page.getByRole("button", { name: "New Session" })
    ).toBeVisible();
  });
});
