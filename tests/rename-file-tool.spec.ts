import { test, expect } from "./fixtures";

test.describe('Rename File Tool Tests', () => {
  test('rename example.spec.ts to example/index.spec.ts and verify with GitHub API', async ({ page, trackCurrentSession }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Create a new session with rename file prompt
    await page.getByRole('button', { name: 'New' }).click();
    const renameMessage = "rename example.spec.ts to example/index.spec.ts";
    await page.getByPlaceholder('Enter an initial prompt').fill(renameMessage);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Assert that renameFile tool execution is running
    await expect(page.getByText("Running renameFile")).toBeVisible({ timeout: 60000 });
    
    // Assert that renameFile tool execution completes successfully
    await expect(page.getByText("Used renameFile")).toBeVisible({ timeout: 60000 });
    
    // Navigate to Details tab to extract branch name from Files Changed section
    await page.getByRole('tab', { name: 'Details', exact: true }).click();
    
    // Wait for Files Changed section and extract branch name from GitHub compare link
    const branchLink = page.locator('a[href*="github.com"][href*="compare/main..."]');
    await expect(branchLink).toBeVisible({ timeout: 10000 });
    
    // Extract branch name from the GitHub compare URL
    const branchHref = await branchLink.getAttribute('href');
    const branchName = branchHref?.split('compare/main...')[1];
    
    expect(branchName).toBeTruthy();
    expect(branchName).not.toBe('');
    
    // Use GitHub proxy API to get files for the branch (same pattern as github-pr-status.spec.ts)
    const buildUrl = process.env.BUILD_URL || "https://dash.empirical.run";
    
    // Make API request to get repository contents via the proxy
    const apiResponse = await page.request.post(`${buildUrl}/api/github/proxy`, {
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        method: 'GET',
        url: `/repos/empirical-run/lorem-ipsum-tests/contents/tests?ref=${branchName}`
      }
    });
    
    // Verify GitHub API call was successful
    expect(apiResponse.ok()).toBeTruthy();
    expect(apiResponse.status()).toBe(200);
    
    // Parse the response and extract file names
    const filesData = await apiResponse.json();
    const fileNames = filesData.map((file: any) => file.name);
    
    // Assert that website.spec.ts exists in the tests directory
    expect(fileNames).toContain('website.spec.ts');
    
    // Additional verification: assert that example.spec.ts no longer exists
    expect(fileNames).not.toContain('example.spec.ts');
    
    // Session will be automatically closed by afterEach hook
  });
});