import { test, expect } from "./fixtures";

test.describe('Filter Investigation', () => {
  test('investigate current filter operators and values for issue type', async ({ page }) => {
    await page.goto('/');
    // TODO(agent on page): Navigate to Issues page, open Filters, add filter for Issue Type, examine operator dropdown options, select each operator and see value options, document all available operators and their corresponding value options
  });
});