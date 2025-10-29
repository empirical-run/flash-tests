import { test, expect } from "./fixtures";

test.describe("Settings Page", () => {
  test("navigate to settings page and assert repo exists message is visible", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to settings page
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'General' }).click();

    // Assert that repository exists by checking the repo location and status
    await expect(page.getByText("empirical-run/lorem-ipsum")).toBeVisible();
    await expect(page.getByText("exists")).toBeVisible();
    await expect(page.getByRole('button', { name: 'View on GitHub' })).toBeVisible();
  });

  test("sync playwright config and verify persistence", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to settings > environments
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Environments' }).click();

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
    
    // Wait for the success toast to appear (can take up to 45 seconds)
    await expect(page.getByText('Playwright configuration has been successfully synced.').first()).toBeVisible({ timeout: 45000 });
    
    // Verify that both project badges are visible after the successful sync
    await expect(page.locator('span.inline-flex', { hasText: 'setup' })).toBeVisible();
    await expect(page.locator('span.inline-flex', { hasText: 'chromium' })).toBeVisible();
    
    // Reload the page to test persistence (this will currently fail as expected)
    await page.reload();
    
    // The projects should still be visible after reload but won't be (demonstrates the bug)
    await expect(page.locator('span.inline-flex', { hasText: 'setup' })).toBeVisible({ timeout: 10000 });
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
    await expect(page.locator('span.inline-flex', { hasText: 'setup' })).not.toBeVisible();
    await expect(page.locator('span.inline-flex', { hasText: 'chromium' })).not.toBeVisible();
  });

  test("Install jira integration", async ({ page, context }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to settings > integrations
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Integrations' }).click();

    // Get environment variables for Atlassian login
    const atlassianEmail = process.env.ATLASSIAN_EMAIL;
    const atlassianPassword = process.env.ATLASSIAN_PASSWORD;
    
    expect(atlassianEmail).toBeTruthy();
    expect(atlassianPassword).toBeTruthy();

    // Click on Connect for Jira and wait for popup
    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Connect' }).nth(2).click();
    const jiraPopup = await popupPromise;

    // Wait for the Atlassian login page to load
    await jiraPopup.waitForLoadState('domcontentloaded');
    
    // Note: The Atlassian login page may show a JavaScript load error in test environments
    // due to network security restrictions. This is a known limitation and expected to fail.
    
    // Fill in the email/username field (this might fail if the page doesn't load properly)
    await jiraPopup.getByLabel('Email address, username, or recovery code').fill(atlassianEmail!);
    
    // Click continue button to proceed to password
    await jiraPopup.getByRole('button', { name: 'Continue' }).click();

    // Wait for password page to load
    await jiraPopup.waitForLoadState('domcontentloaded');

    // Fill in the password field
    await jiraPopup.getByLabel('Password').fill(atlassianPassword!);

    // Click the login button
    await jiraPopup.getByRole('button', { name: 'Log in' }).click();

    // Wait for the OAuth consent/grant page to load
    await jiraPopup.waitForLoadState('domcontentloaded');

    // Accept/grant access
    await jiraPopup.getByRole('button', { name: 'Accept' }).click();

    // Wait for redirect back to the main app
    await page.waitForURL(/integrations/, { timeout: 15000 });

    // Assert that Jira is now installed (expected to fail until the integration is fully working)
    await expect(page.getByText('Jira')).toBeVisible();
    await expect(page.getByText('Installed').nth(1)).toBeVisible();
  });
});