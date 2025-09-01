import { test, expect } from "./fixtures";

test.describe('Rename File Tool Tests', () => {
  test('rename example.spec.ts to website.spec.ts and verify with GitHub API', async ({ page, trackCurrentSession }) => {
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
    const renameMessage = "rename example.spec.ts to website.spec.ts";
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
    
    // Extract branch name from the UI - visible in top right with prefix pattern
    // Look for branch info in the top navigation area
    const branchElement = page.locator('[data-testid="branch-name"]').or(
      page.locator('text=/^empiricalrun-bot\//').or(
        page.locator('text=/^bot\//').or(
          page.locator('[title*="branch" i]').or(
            page.locator('text=/^[a-z-]+\/[a-z0-9-]+$/')
          )
        )
      )
    );
    
    // Wait for branch element to be visible
    await expect(branchElement.first()).toBeVisible({ timeout: 10000 });
    
    // Extract the branch name
    const branchText = await branchElement.first().textContent();
    console.log('Branch text found:', branchText);
    
    // Extract actual branch name (remove any prefixes)
    const branchName = branchText?.replace(/^(empiricalrun-bot\/|bot\/)/, '') || branchText;
    console.log('Extracted branch name:', branchName);
    
    expect(branchName).toBeTruthy();
    expect(branchName).not.toBe('');
    
    // Use GitHub API to get files for the branch
    // Make API request to get repository contents
    const apiUrl = `https://api.github.com/repos/empiricalrun/flash-tests/contents/tests?ref=${branchName}`;
    
    // Make the API request using page.request for better integration
    const apiResponse = await page.request.get(apiUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'playwright-test'
      }
    });
    
    expect(apiResponse.ok()).toBeTruthy();
    expect(apiResponse.status()).toBe(200);
    
    const filesData = await apiResponse.json();
    console.log('GitHub API response:', filesData);
    
    // Extract file names from the API response
    const fileNames = filesData.map((file: any) => file.name);
    console.log('Files in tests directory:', fileNames);
    
    // Assert that website.spec.ts exists in the tests directory (this will fail currently)
    expect(fileNames).toContain('website.spec.ts');
    
    // Additional verification: assert that example.spec.ts no longer exists
    expect(fileNames).not.toContain('example.spec.ts');
    
    console.log('✅ Successfully verified rename file tool execution:');
    console.log('  1. renameFile tool was executed (Running and Used states)');
    console.log('  2. Branch name was extracted from UI:', branchName);
    console.log('  3. GitHub API was called successfully');
    console.log('  4. website.spec.ts file exists at tests/website.spec.ts');
    console.log('  5. example.spec.ts file no longer exists');
    
    // Session will be automatically closed by afterEach hook
  });
});