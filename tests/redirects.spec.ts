import { test, expect } from "./fixtures";

test.describe("URL Redirects", () => {
  test("auto redirect to project slug routes", async ({ page }) => {
    // Navigate to settings/integrations without project slug
    await page.goto("/settings/integrations");
    
    // Wait for page to load and verify integrations page content is visible
    await expect(page.getByRole('heading', { name: 'GitHub', exact: true })).toBeVisible({ timeout: 10000 });
    
    // Verify that we've been redirected to the correct path with project slug
    await expect(page).toHaveURL(/\/lorem-ipsum\/settings\/integrations/);
  });
});
