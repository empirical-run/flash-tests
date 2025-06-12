import { test, expect } from "./fixtures";

test.describe("Settings", () => {
  test("open settings and assert that repo exists is shown", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to settings
    await page.getByRole('link', { name: 'Settings' }).click();

    // TODO(agent on page): Look for any text that says "repo exists" or similar repository-related text and assert it's visible
  });
});