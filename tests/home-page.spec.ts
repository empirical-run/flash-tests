import { test, expect } from "./fixtures";

test.describe('Home Page Tests', () => {
  test('toggle shows Lorem Ipsum', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for page to load
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // TODO(agent on page): Click on the toggle to show Lorem Ipsum and verify it's visible
  });
});
