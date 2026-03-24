import { test, expect } from "./fixtures";

test.describe('Command Bar', () => {
  test('Search and navigate to settings via command bar', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Press Ctrl/Cmd + K to open the command bar
    await page.keyboard.press('ControlOrMeta+K');
    
    // TODO(agent on page): The command bar should now be open. Identify the search input for the command bar (check role, placeholder text, etc.) and type "settings" in it, then wait for a result that contains "Settings" to appear and press Enter to navigate to it.
    
    // Verify we're navigated to the settings page
    await expect(page).toHaveURL(/settings/);
  });
});
