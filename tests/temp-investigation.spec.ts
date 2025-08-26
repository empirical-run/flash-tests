import { test, expect } from "./fixtures";

test('investigate title field operators', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Issues' }).click();
  await page.getByRole('button', { name: 'Filters' }).click();
  await page.getByRole('button', { name: 'Add filter' }).click();
  await page.getByRole('combobox').filter({ hasText: 'Field' }).click();
  await page.getByRole('option', { name: 'Title' }).click();
  
  // TODO(agent on page): Click on the equals operator dropdown to see all available operators for Title field
});