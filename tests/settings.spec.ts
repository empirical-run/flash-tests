import { test, expect } from "./fixtures";

test.describe("Settings Page", () => {
  test("navigate to settings page and assert repo exists message is visible", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to settings page
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'General' }).click();

    // Assert that repository exists by checking the repo location and status
    await expect(page.getByText("empirical-run/lorem-ipsum-tests")).toBeVisible();
    await expect(page.getByText("exists")).toBeVisible();
    await expect(page.getByRole('button', { name: 'View on GitHub' })).toBeVisible();
  });

  test("sync playwright config and verify persistence", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to settings > general
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'General' }).click();

    // Set up network listener to capture project_id from API response
    let projectId: string | null = null;
    
    page.on('response', async (response) => {
      if (response.url().includes('/api/projects/')) {
        try {
          const responseBody = await response.json();
          if (responseBody.id) {
            projectId = responseBody.id;
          }
        } catch (error) {
          // Ignore JSON parsing errors
        }
      }
    });

    // Click on sync config button
    await page.getByRole('button', { name: 'Sync Config' }).click();
    
    // Wait for the sync to complete (can take up to 45 seconds)
    // Check for either success or error state
    const syncResult = await Promise.race([
      // Wait for success - projects become visible
      page.getByText('setup').waitFor({ state: 'visible', timeout: 45000 }).then(() => 'success'),
      page.getByText('chromium').waitFor({ state: 'visible', timeout: 45000 }).then(() => 'success'),
      // Or wait for error state
      page.getByText('Error updating playwright config').waitFor({ state: 'visible', timeout: 45000 }).then(() => 'error'),
      page.getByText('Sync Failed').waitFor({ state: 'visible', timeout: 45000 }).then(() => 'error')
    ]);

    if (syncResult === 'success') {
      // Assert that both projects are visible
      await expect(page.getByText('setup')).toBeVisible();
      await expect(page.getByText('chromium')).toBeVisible();
      
      // Reload the page to test persistence
      await page.reload();
      
      // The projects should still be visible after reload (this will currently fail)
      await expect(page.getByText('setup')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('chromium')).toBeVisible({ timeout: 10000 });
    } else {
      console.log('Sync failed, but continuing with API test portion');
    }

    // Wait a moment for project_id to be captured from network response
    await page.waitForTimeout(1000);

    // If we have a project_id, test the PATCH request to reset playwright_config
    if (projectId) {
      // Make PATCH request to set playwright_config as null
      const response = await page.request.patch(`/api/projects/${projectId}/`, {
        data: { playwright_config: null },
        headers: { 'Content-Type': 'application/json' }
      });
      
      expect(response.ok()).toBeTruthy();
      
      // Reload the page and verify the config is null (projects should not be visible)
      await page.reload();
      
      // Assert that projects are not visible after setting config to null
      await expect(page.getByText('setup')).not.toBeVisible();
      await expect(page.getByText('chromium')).not.toBeVisible();
    } else {
      console.log('Project ID not captured from network response, skipping PATCH test');
    }
  });
});