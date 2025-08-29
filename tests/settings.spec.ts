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

  test("sync playwright config functionality", async ({ page }) => {
    let projectId: string | null = null;

    // Set up network monitoring to capture project ID
    page.on('response', response => {
      const url = response.url();
      // Look for project API calls that might contain the project ID
      if (url.includes('/api/project/') || url.includes('/api/projects/')) {
        const match = url.match(/\/api\/projects?\/([^\/\?]+)/);
        if (match && match[1]) {
          projectId = match[1];
        }
      }
    });

    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to settings > general
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'General' }).click();

    // Click on sync config button
    await page.getByRole('button', { name: 'Sync Config' }).click();

    // Assert that 2 projects are visible (setup and chromium) - can take up to 45 seconds
    await expect(page.getByText('setup')).toBeVisible({ timeout: 45000 });
    await expect(page.getByText('chromium')).toBeVisible({ timeout: 45000 });

    // Reload the page
    await page.reload();

    // The projects should still be visible (this will currently fail according to user)
    await expect(page.getByText('setup')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('chromium')).toBeVisible({ timeout: 10000 });

    // Ensure we captured a project ID from network calls
    expect(projectId).toBeTruthy();

    // Make PATCH request to set playwright_config as null
    const response = await page.request.patch(`/api/project/${projectId}/`, {
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        playwright_config: null
      }
    });

    expect(response.ok()).toBeTruthy();

    // Reload page to see the changes
    await page.reload();

    // Assert that playwright_config is null on the dashboard
    // This might need to be adjusted based on how null config is displayed
    await expect(page.getByText('setup')).not.toBeVisible();
    await expect(page.getByText('chromium')).not.toBeVisible();
  });
});