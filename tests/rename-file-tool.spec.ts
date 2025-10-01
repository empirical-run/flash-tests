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

    // Wait for the renameFile tool entry (regardless of final status) to appear in the chat
    const renameToolEntry = page.locator('[data-message-id]').filter({ hasText: /renameFile tool/i }).first();
    await expect(renameToolEntry).toBeVisible({ timeout: 60000 });

    // Click on the tool entry to expand/view details
    await renameToolEntry.click();
    
    // View the renameFile tool call details to confirm the correct paths were sent
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    await expect(page.getByText(/Tool Call\s*:\s*renameFile/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/"oldPath"\s*:\s*"tests\/example\.spec\.ts"/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/"newPath"\s*:\s*"tests\/example\/index\.spec\.ts"/)).toBeVisible({ timeout: 10000 });

    // Navigate to Details tab to extract branch name from Files Changed section
    await page.getByRole('tab', { name: 'Details', exact: true }).click();
    
    // Wait for Files Changed section and extract branch name from GitHub compare link
    const branchLink = page.locator('a[href*="github.com/empirical-run/lorem-ipsum-tests/compare/"]').first();
    await expect(branchLink).toBeVisible({ timeout: 10000 });

    // Extract branch name from the GitHub compare URL allowing for different base branches
    const branchHref = await branchLink.getAttribute('href');
    const branchNameMatch = branchHref?.match(/compare\/[^.]+\.{3}([^?]+)/);
    const branchName = branchNameMatch?.[1];
    
    expect(branchName).toBeTruthy();
    expect(branchName).not.toBe('');
    
    // Use GitHub proxy API to get files for the branch (same pattern as github-pr-status.spec.ts)
    const buildUrl = process.env.BUILD_URL || "https://dash.empirical.run";

    // Poll GitHub proxy until the branch contents are available
    let filesData: any[] | null = null;
    await expect.poll(async () => {
      const response = await page.request.post(`${buildUrl}/api/github/proxy`, {
        headers: {
          'Content-Type': 'application/json'
        },
        data: {
          method: 'GET',
          url: `/repos/empirical-run/lorem-ipsum-tests/contents/tests?ref=${branchName}`
        }
      });
      if (!response.ok()) {
        return false;
      }
      filesData = await response.json();
      return true;
    }, { timeout: 60000, intervals: [1000, 2000, 4000, 8000] }).toBeTruthy();

    if (!filesData) {
      throw new Error(`Failed to load repository contents for branch ${branchName}`);
    }

    const fileNames = filesData.map((file: any) => file.name);
    
    // Assert that example directory exists in the tests directory
    expect(fileNames).toContain('example');
    
    // Additional verification: assert that example.spec.ts no longer exists in tests root
    expect(fileNames).not.toContain('example.spec.ts');
    
    // Poll the example subdirectory until the renamed file is present
    let exampleFilesData: any[] | null = null;
    await expect.poll(async () => {
      const response = await page.request.post(`${buildUrl}/api/github/proxy`, {
        headers: {
          'Content-Type': 'application/json'
        },
        data: {
          method: 'GET',
          url: `/repos/empirical-run/lorem-ipsum-tests/contents/tests/example?ref=${branchName}`
        }
      });
      if (!response.ok()) {
        return false;
      }
      exampleFilesData = await response.json();
      return true;
    }, { timeout: 60000, intervals: [1000, 2000, 4000, 8000] }).toBeTruthy();

    if (!exampleFilesData) {
      throw new Error(`Failed to load example directory contents for branch ${branchName}`);
    }

    const exampleFileNames = exampleFilesData.map((file: any) => file.name);
    
    // Assert that index.spec.ts exists in the example directory
    expect(exampleFileNames).toContain('index.spec.ts');
    
    // Session will be automatically closed by afterEach hook
  });
});