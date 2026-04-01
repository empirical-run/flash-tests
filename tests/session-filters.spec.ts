import { test, expect } from "./fixtures";
import { navigateToSessions } from "./pages/sessions";

test.describe('Session Filters', () => {
  test('User filter respects authorization - searching for unauthorized user shows no results', async ({ page }) => {
    await navigateToSessions(page);
    
    // Click on the "Filters" button to open filter options
    await page.getByRole('button', { name: 'Filters' }).click();
    
    // Click on the "Created by" dropdown (shows "All users" by default)
    await page.getByRole('button', { name: 'All users' }).click();
    
    // Wait for the user list to load by checking for the "(Select All)" option
    await expect(page.getByRole('option', { name: '(Select All)' })).toBeVisible();
    
    // Assert that the automation-test user is visible (authorized user should appear)
    await expect(page.getByRole('option', { name: 'automation-test' })).toBeVisible();
    
    // Type "Arpit" in the users search/filter input
    await page.getByPlaceholder('Search...').fill('Arpit');
    
    // Assert that no results are visible - should show "No results found" or similar
    await expect(page.getByText('No results found')).toBeVisible();
  });
});
