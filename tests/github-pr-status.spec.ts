import { test, expect } from "./fixtures";
import { createSession, navigateToSessions, waitForFirstMessage, openReviewPanel, waitForPRButton } from "./pages/sessions";

test.describe('GitHub PR Status Tests', () => {
  test('create session, send message, detect branch, create PR, and verify PR status in UI', async ({ page, trackCurrentSession }) => {
    // Step 1: Create a new session
    await navigateToSessions(page);
    
    // Create a new session with README update prompt.
    // The agent is asked to create the PR itself so that the platform's PR creation
    // flow runs — this is the flow that injects session ID and user info into the PR description.
    const timestamp = new Date().toISOString().replace('T', ' at ').replace('Z', ' UTC').replace(/\.\d{3}/, (match) => match);
    const formattedDate = `Updated on: ${timestamp}`;
    const message = `update the README.md file to include this exact text at the top: "${formattedDate}" - do this change without asking me for anything else - use str replace (not insert) tool - then create a pull request`;
    await createSession(page, message);
    
    // Wait for the session chat page to load completely by waiting for message to appear
    await waitForFirstMessage(page);
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Extract session ID from URL (after the session page has fully loaded)
    const sessionUrl = page.url();
    const sessionIdMatch = sessionUrl.match(/\/sessions\/([^?&#/]+)/);
    const sessionId = sessionIdMatch?.[1] ?? null;
    expect(sessionId).toBeTruthy();
    
    // Wait for the read tool execution to complete
    await expect(page.getByText(/Used read tool/).first()).toBeVisible({ timeout: 60000 });
    
    // Wait for the edit tool to complete
    await expect(page.getByText(/Used edit tool/).first()).toBeVisible({ timeout: 150000 });

    const buildUrl = process.env.BUILD_URL || "https://dash.empirical.run";

    // Step 2: Wait for the agent to create the PR via the platform's PR creation flow.
    // The PR button (e.g. "PR #42") appears in the session header once the platform has
    // created and linked the PR — this is the same flow that injects session metadata.
    const prButton = await waitForPRButton(page, 120000);
    const prButtonText = await prButton.first().textContent();
    const prNumber = prButtonText?.match(/PR #(\d+)/)?.[1];
    expect(prNumber).toBeTruthy();

    // Step 3: Verify the PR description contains the session ID and user info.
    // The platform injects this metadata at PR creation time through its own flow.
    const userEmail = process.env.AUTOMATED_USER_EMAIL;
    expect(userEmail).toBeTruthy();

    const getPrDescription = async (): Promise<string> => {
      const res = await page.request.post(`${buildUrl}/api/github/proxy`, {
        headers: { 'Content-Type': 'application/json' },
        data: { method: 'GET', url: `/repos/empirical-run/lorem-ipsum-tests/pulls/${prNumber}` }
      });
      const data = await res.json();
      return data.body || '';
    };

    // Poll in case there is a brief async delay before the description is finalized
    await expect.poll(getPrDescription, {
      message: `PR description should contain session ID "${sessionId}"`,
      timeout: 30000,
      intervals: [3000]
    }).toContain(sessionId);

    const prBody = await getPrDescription();
    expect(prBody, `PR description should contain user email "${userEmail}"`).toContain(userEmail);
    
    // Step 4: Close the PR via UI
    await openReviewPanel(page);
    
    await page.getByRole('button', { name: 'Close PR' }).click();
    await page.getByRole('button', { name: 'Close PR' }).click();
    
    // Wait for the async close operation to complete
    await page.waitForTimeout(3000);
    
    // Step 5: Verify PR is closed via API
    const prStatusResponse = await page.request.post(`${buildUrl}/api/github/proxy`, {
      headers: { 'Content-Type': 'application/json' },
      data: { method: 'GET', url: `/repos/empirical-run/lorem-ipsum-tests/pulls/${prNumber}` }
    });
    
    expect(prStatusResponse.status()).toBe(200);
    const updatedPrData = await prStatusResponse.json();
    expect(updatedPrData.state).toBe('closed');
  });
});
