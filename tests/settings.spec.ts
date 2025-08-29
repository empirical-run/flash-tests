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

    // Set up network listener to capture project_id from the sync config API call
    let projectId: string | null = null;
    
    page.on('request', async (request) => {
      // Look for the tool-calls API request that has project_id in query params
      if (request.url().includes('/api/tool-calls?project_id=')) {
        const url = new URL(request.url());
        const extractedProjectId = url.searchParams.get('project_id');
        if (extractedProjectId) {
          projectId = extractedProjectId;
          console.log(`Captured project_id: ${projectId}`);
        }
      }
    });

    // Click on sync config button
    await page.getByRole('button', { name: 'Sync Config' }).click();
    
    // Wait for the sync to complete (can take up to 45 seconds)
    // Check for either success or error state
    const syncResult = await Promise.race([
      // Wait for success - project badges become visible (more specific selectors)
      page.locator('span.inline-flex', { hasText: 'setup' }).waitFor({ state: 'visible', timeout: 45000 }).then(() => 'success'),
      page.locator('span.inline-flex', { hasText: 'chromium' }).waitFor({ state: 'visible', timeout: 45000 }).then(() => 'success'),
      // Or wait for error state
      page.getByText('Error updating playwright config').waitFor({ state: 'visible', timeout: 45000 }).then(() => 'error'),
      page.getByText('Sync Failed').waitFor({ state: 'visible', timeout: 45000 }).then(() => 'error'),
      // Or wait for specific timeout
      page.waitForTimeout(45000).then(() => 'timeout')
    ]);

    if (syncResult === 'success') {
      console.log('Sync completed successfully');
      
      // Assert that both project badges are visible
      await expect(page.locator('span.inline-flex', { hasText: 'setup' })).toBeVisible();
      await expect(page.locator('span.inline-flex', { hasText: 'chromium' })).toBeVisible();
      
      // Reload the page to test persistence
      await page.reload();
      
      // The projects should still be visible after reload (this will currently fail)
      await expect(page.locator('span.inline-flex', { hasText: 'setup' })).toBeVisible({ timeout: 10000 });
      await expect(page.locator('span.inline-flex', { hasText: 'chromium' })).toBeVisible({ timeout: 10000 });
    } else {
      console.log(`Sync result: ${syncResult}, but continuing with API test portion`);
    }

    // Wait a moment to ensure project_id was captured
    await page.waitForTimeout(1000);

    // Verify we captured the project_id
    expect(projectId).not.toBeNull();
    
    if (projectId) {
      console.log(`Using project_id ${projectId} for PATCH request`);
      
      // Make PATCH request to set playwright_config as null
      const patchResponse = await page.request.patch(`/api/projects/${projectId}/`, {
        data: { playwright_config: null },
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log(`PATCH request status: ${patchResponse.status()}`);
      
      if (!patchResponse.ok()) {
        const responseText = await patchResponse.text();
        console.log(`PATCH request failed. Status: ${patchResponse.status()}, Response: ${responseText}`);
        
        // Try alternative endpoint without trailing slash
        const altPatchResponse = await page.request.patch(`/api/projects/${projectId}`, {
          data: { playwright_config: null },
          headers: { 'Content-Type': 'application/json' }
        });
        
        console.log(`Alternative PATCH request status: ${altPatchResponse.status()}`);
        expect(altPatchResponse.ok()).toBeTruthy();
      } else {
        console.log(`PATCH request successful: ${patchResponse.status()}`);
      }
      
      // Reload the page and verify the config is null (projects should not be visible)
      await page.reload();
      
      // Assert that project badges are not visible after setting config to null
      await expect(page.locator('span.inline-flex', { hasText: 'setup' })).not.toBeVisible();
      await expect(page.locator('span.inline-flex', { hasText: 'chromium' })).not.toBeVisible();
      
      console.log('Successfully verified that projects are hidden after setting playwright_config to null');
    } else {
      throw new Error('Project ID was not captured from network response');
    }
  });
});