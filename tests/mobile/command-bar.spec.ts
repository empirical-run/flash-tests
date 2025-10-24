import { test, expect } from '../fixtures';

test.describe('Mobile Command Bar', () => {
  test('open command bar on mobile', async ({ page }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Verify mobile viewport is being used
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThanOrEqual(412); // Pixel 7 width
    
    // Wait for page to load - Sessions page should be visible
    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
    
    // Wait for the sessions table to load
    const firstSessionRow = page.locator('table tbody tr').first();
    await expect(firstSessionRow).toBeVisible({ timeout: 10000 });
    
    // Get the session ID from the first cell of the row
    const sessionIdCell = firstSessionRow.locator('td').first();
    await expect(sessionIdCell).toHaveText(/.+/, { timeout: 10000 });
    const sessionId = await sessionIdCell.textContent();
    expect(sessionId).toBeTruthy();
    
    // Click on the title cell (second cell) to open the session
    const titleCell = firstSessionRow.locator('td').nth(1);
    await titleCell.click();
    
    // Verify we're in a session page
    await expect(page).toHaveURL(/sessions\//, { timeout: 10000 });
    
    // Wait for the first chat message to load so the session is properly recorded in recent sessions
    await expect(page.locator('[data-message-id]').first()).toBeVisible({ timeout: 30000 });
    
    // Click on profile icon in the top right corner
    await page.getByRole('button', { name: 'Toggle user menu' }).click();
    
    // Click on "Command Bar" option from the menu
    await page.getByRole('menuitem', { name: 'Command Bar' }).click();
    
    // Wait for command bar to be visible (combobox with search input)
    const commandBarInput = page.getByPlaceholder('Type a command or search…');
    await expect(commandBarInput).toBeVisible({ timeout: 5000 });
    
    // Click on the input to ensure it's focused and trigger any dropdown content
    await commandBarInput.click();
    
    // Verify that the session ID is visible in the command bar (recent sessions section)
    await expect(page.getByText(sessionId!.trim()).first()).toBeVisible({ timeout: 15000 });
  });
});
