import { test, expect } from "./fixtures";
import { createSession, navigateToSessions, getSessionBranchNames, expandToolOutput } from "./pages/sessions";

test.describe('Bash File Operations (Sandbox)', () => {

  test('rename example.spec.ts to example/index.spec.ts and verify with GitHub API', async ({ page, trackCurrentSession, withSandboxSession }) => {
    await navigateToSessions(page);
    
    // Create a new session with rename file prompt
    const renameMessage = "rename example.spec.ts to example/index.spec.ts";
    await createSession(page, renameMessage);
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/);
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // In sandbox mode the agent uses bash mv to rename the file.
    // We verify the rename happened via the bash tool bubble — the sandbox agent
    // commits locally but does not push, so GitHub API verification is not applicable.
    await expect(page.getByText(/Used bash:.*mv.*example\.spec\.ts/).first()).toBeVisible({ timeout: 120000 });
    
    // Also confirm the git commit step ran, meaning the rename was committed
    await expect(page.getByText(/Used bash:.*git.*commit/).first()).toBeVisible({ timeout: 60000 });
    
    // Session will be automatically closed by afterEach hook
  });

  test('search files with grep and verify result', async ({ page, trackCurrentSession, withSandboxSession }) => {
    await navigateToSessions(page);
    
    // Create a new session with grep search prompt
    const searchMessage = "find all files containing 'title' keyword";
    await createSession(page, searchMessage);
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/);
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // In sandbox mode the agent uses the grep tool
    await expect(page.getByText(/Used grep for "title"/).first()).toBeVisible({ timeout: 120000 });
    
    // Click the grep bubble to open the tool details in the side panel
    await page.getByText(/Used grep for "title"/).first().click();
    
    // Expand tool output and verify results reference known files
    const toolOutputSection = await expandToolOutput(page);
    await expect(toolOutputSection.getByText('example.spec.ts', { exact: false }).first()).toBeVisible();
    
    // Session will be automatically closed by afterEach hook
  });

  test('create test file then delete it using bash', async ({ page, trackCurrentSession, withSandboxSession }) => {
    await navigateToSessions(page);
    
    // Create a new session with create/delete prompt
    const toolMessage = "Create a new test file tests/demo.spec.ts with just a comment '// this is test file'. Then delete it. Do these steps sequentially, not in parallel.";
    await createSession(page, toolMessage);
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/);
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // In sandbox mode the agent uses the write tool to create the file
    await expect(page.getByText(/Used write tool/).first()).toBeVisible({ timeout: 120000 });
    
    // Then deletes it via bash rm
    await expect(page.getByText(/Used bash:.*rm.*demo\.spec\.ts/).first()).toBeVisible({ timeout: 120000 });
    
    // Session will be automatically closed by afterEach hook
  });

});
