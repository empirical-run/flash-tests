import { test, expect } from "./fixtures";

test.describe('Issues Tests', () => {
  test('open issues page', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Click on Issues in the sidebar
    await page.getByRole('link', { name: 'Issues', exact: true }).click();
    
    // Wait for issues page to load
    await expect(page).toHaveURL(/issues$/, { timeout: 10000 });
    
    // TODO(agent on page): Navigate to the Issues page, examine the current layout and identify what elements are visible in the grid view that can be used for test assertions
  });
});