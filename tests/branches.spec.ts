import { test, expect } from "./fixtures";

test.describe("Branches", () => {
  test("navigate to branches page, click new merge, and close modal", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    
    // The Branches page now lives under project Settings.
    await page.goto('/lorem-ipsum/settings/branches');
    
    // Verify we're on the Branches settings page
    await expect(page.getByRole('heading', { name: 'Branches' })).toBeVisible();
    
    // Click on New Merge button to open the modal
    await page.getByRole('button', { name: 'New Merge' }).click();
    
    // Verify the modal is open by checking for the modal heading
    await expect(page.getByRole('heading', { name: 'Create New Merge' })).toBeVisible();
    
    // Close the modal using the Close button
    await page.getByRole('button', { name: 'Close' }).last().click();
    
    // Verify the modal is closed by checking that the modal heading is no longer visible
    await expect(page.getByRole('heading', { name: 'Create New Merge' })).not.toBeVisible();
    
    // Verify we're still on the Branches settings page
    await expect(page.getByRole('heading', { name: 'Branches' })).toBeVisible();
  });
});
