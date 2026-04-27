import { test, expect } from "./fixtures";

test.describe("Snoozes Page", () => {
  test("navigates to snoozes page and shows active and expired sections", async ({ page }) => {
    await page.goto("/");

    // Navigate to Snoozes via the sidebar
    await page.getByRole("link", { name: "Snoozes" }).click();

    // Verify the URL contains "snoozes"
    await expect(page).toHaveURL(/snoozes/);

    // Verify the page heading is visible
    await expect(page.getByRole("heading", { name: "Snoozes" })).toBeVisible();

    // Verify the "Active" section is present
    await expect(page.getByText("Active", { exact: true })).toBeVisible();

    // Verify the "New Snooze" button is present
    await expect(
      page.getByRole("button", { name: "New Snooze" })
    ).toBeVisible();
  });
});
