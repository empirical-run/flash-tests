import { test, expect } from '../fixtures';

test.describe('Mobile Command Bar', () => {
  test('Open command bar and navigate to settings on mobile', async ({ page }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Verify mobile viewport is being used
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThanOrEqual(412); // Pixel 7 width
    
    // The new mobile shell exposes the user menu directly in the header.
    await page.getByRole('button', { name: 'automation-test@example.com' }).click();
    
    // Click on "Command Bar" option from the menu
    await page.getByRole('menuitem', { name: 'Command Bar' }).click();
    
    // Wait for command bar to be visible
    const commandBarInput = page.getByPlaceholder('Type a command or search...');
    await expect(commandBarInput).toBeVisible();
    
    // Search by project name so its settings result is not cut off by generic results.
    await commandBarInput.fill('lorem settings');
    
    // Wait for the settings option to be visible. Scope to the "Projects" group
    // and use exact match: the command bar now also lists nested settings
    // sub-pages (e.g. "Lorem Ipsum › Settings › Profile") and can surface the
    // same "Lorem Ipsum › Settings" entry in the "Recent" group, both of which
    // would otherwise trigger a strict-mode violation.
    const projectSettingsResult = page
      .getByLabel('Projects')
      .getByText('Lorem Ipsum › Settings', { exact: true });
    await expect(projectSettingsResult).toBeVisible();
    
    // Select the exact project destination instead of relying on result ranking.
    await projectSettingsResult.click();
    
    // Verify we're navigated to the settings page
    await expect(page).toHaveURL(/settings/);
  });
});
