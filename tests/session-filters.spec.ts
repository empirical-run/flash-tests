import { test, expect } from "./fixtures";

test.describe('Session Filters', () => {
  test('User filter respects authorization - searching for unauthorized user shows no results', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions page
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Click on the "Filters" button to open filter options
    await page.getByRole('button', { name: 'Filters' }).click();
    
    // Click on the "Created by" dropdown (shows "All users" by default)
    await page.getByRole('button', { name: 'All users' }).click();
    
    // Wait for the user list to load by checking for the "(Select All)" option
    await expect(page.getByRole('option', { name: '(Select All)' })).toBeVisible({ timeout: 10000 });
    
    // Assert that the automation-test user is visible (authorized user should appear)
    await expect(page.getByRole('option', { name: 'automation-test' })).toBeVisible();
    
    // Type "Arpit" in the users search/filter input
    await page.getByPlaceholder('Search...').fill('Arpit');
    
    // Assert that no results are visible - should show "No results found" or similar
    await expect(page.getByText('No results found')).toBeVisible({ timeout: 5000 });
  });
});
