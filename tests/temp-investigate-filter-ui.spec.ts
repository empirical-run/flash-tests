import { test, expect } from "./fixtures";

test.describe('Investigate Filter UI', () => {
  test('investigate issue type filter UI structure', async ({ page }) => {
    await page.goto('/');
    
    // TODO(agent on page): Navigate to issues page, click Filters, Add filter, select Issue Type field, then explore what options are available for operators and how to select "is any of"
  });
});