import { test, expect } from "./fixtures";

test('investigate title field operators', async ({ page }) => {
  await page.goto('/');
  // TODO(agent on page): Navigate to Issues page, open Filters, add a filter for Title field, click on the operator dropdown and list all available options
});