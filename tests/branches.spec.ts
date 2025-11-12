import { test, expect } from "./fixtures";

test.describe("Branches", () => {
  test("navigate to branches page and click new merge", async ({ page }) => {
    // Navigate directly to branches page (no sidebar link available)
    await page.goto("/branches");
    
    // Click on "New Merge" button
    await page.getByRole('button', { name: 'New Merge' }).click();
    
    // Verify the "Create New Merge" modal appears
    await expect(page.getByRole('heading', { name: 'Create New Merge' })).toBeVisible();
  });
});
