import { test, expect } from "./fixtures";

test.describe('Investigate Multi-Select UI', () => {
  test('investigate multi-value selection for is any of', async ({ page }) => {
    await page.goto('/');
    
    // TODO(agent on page): Navigate to issues page, open filters, add filter for Issue Type, select "is any of" operator, then select "Unknown" first and explore what UI options are available for selecting a second value
  });
});