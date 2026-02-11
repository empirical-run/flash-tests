import { test, expect } from "./fixtures";

test.describe("Settings Page", () => {
  test("navigate to settings page and assert repo exists message is visible", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to settings page
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'General' }).click();

    // Assert that repository exists by checking the repo location and status
    await expect(page.getByText("empirical-run/lorem-ipsum")).toBeVisible();
    await expect(page.getByText("exists")).toBeVisible();
    await expect(page.getByRole('button', { name: 'View on GitHub' })).toBeVisible();
  });

  test.skip("sync playwright config and verify persistence", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to settings > environments
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Environments', exact: true }).click();

    // Set up network listener to capture project_id from the sync config API call
    let projectId: string | null = null;
    
    page.on('request', async (request) => {
      // Look for the tool-calls API request that has project_id in query params
      if (request.url().includes('/api/tool-calls?project_id=')) {
        const url = new URL(request.url());
        const extractedProjectId = url.searchParams.get('project_id');
        if (extractedProjectId) {
          projectId = extractedProjectId;
        }
      }
    });

    // Click on sync config button
    await page.getByRole('button', { name: 'Sync Config' }).click();
    
    // Wait for the success toast to appear (can take up to 60 seconds)
    await expect(page.getByText('Playwright configuration has been successfully synced.').first()).toBeVisible({ timeout: 60000 });
    
    // Verify that chromium project badge is visible after the successful sync
    await expect(page.locator('span.inline-flex', { hasText: 'chromium' })).toBeVisible();
    
    // Reload the page to test persistence (this will currently fail as expected)
    await page.reload();
    
    // The projects should still be visible after reload but won't be (demonstrates the bug)
    await expect(page.locator('span.inline-flex', { hasText: 'chromium' })).toBeVisible({ timeout: 10000 });

    // Verify we captured the project_id
    expect(projectId).not.toBeNull();
    
    // Make PATCH request to set playwright_config as null
    const patchResponse = await page.request.patch(`/api/projects/${projectId}/`, {
      data: { 
        playwright_config: null
      },
      headers: { 'Content-Type': 'application/json' }
    });
    
    expect(patchResponse.ok()).toBeTruthy();
    
    // Reload the page and verify the config is null (projects should not be visible)
    await page.reload();
    
    // Assert that project badges are not visible after setting config to null
    await expect(page.locator('span.inline-flex', { hasText: 'chromium' })).not.toBeVisible();
  });
});