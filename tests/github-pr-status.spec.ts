import { test, expect } from "./fixtures";
import { createSession, getSessionIdFromUrl, navigateToSessions, waitForFirstMessage, openReviewPanel, waitForPRButton } from "./pages/sessions";
import { getDashboardBaseUrl } from "./pages/urls";

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
    const sessionId = getSessionIdFromUrl(page);
    
    // Wait for the read tool execution to complete
    await expect(page.getByText(/Used read tool/).first()).toBeVisible({ timeout: 60000 });
    
    // Wait for the edit tool to complete
    await expect(page.getByText(/Used edit tool/).first()).toBeVisible({ timeout: 150000 });

    const buildUrl = getDashboardBaseUrl();

    // Step 2: Wait for the agent to create the PR via the platform's PR creation flow.
    // The PR button (e.g. "PR #42") appears in the session header once the platform has
    // created and linked the PR — this is the same flow that injects session metadata.
    const prButton = await waitForPRButton(page, 120000);
    // Confirm the text has stabilised before reading it
    await expect(prButton.first()).toHaveText(/PR #\d+/);
    const prButtonText = await prButton.first().textContent();
    const prNumber = prButtonText?.match(/PR #(\d+)/)?.[1];
    expect(prNumber).toBeTruthy();

    // Step 3: Verify the PR description contains the session ID and user info.
    // The platform injects this metadata at PR creation time through its own flow.
    const userEmail = process.env.AUTOMATED_USER_EMAIL;
    expect(userEmail, 'AUTOMATED_USER_EMAIL env var must be set').toBeTruthy();

    // Poll in case there is a brief async delay before the description is finalized.
    // Both sessionId and userEmail are checked inside the same poll so that if the
    // platform ever writes them in separate async steps, we retry until both are present.
    let finalPrBody = '';
    await expect.poll(async () => {
      const res = await page.request.post(`${buildUrl}/api/github/proxy`, {
        headers: { 'Content-Type': 'application/json' },
        data: { method: 'GET', url: `/repos/empirical-run/lorem-ipsum-tests/pulls/${prNumber}` }
      });
      const data = await res.json();
      finalPrBody = data.body || '';
      return finalPrBody.includes(sessionId!) && finalPrBody.includes(userEmail!);
    }, {
      message: `PR description should contain session ID "${sessionId}" and user email "${userEmail}"`,
      timeout: 30000,
      intervals: [3000]
    }).toBe(true);

    // Step 4: Close the PR via UI
    await openReviewPanel(page);
    
    await page.getByRole('button', { name: 'Close PR' }).click();
    await page.getByRole('button', { name: 'Close PR' }).click();
    
    // Step 5: Poll until the PR is confirmed closed via API (avoids a fixed sleep)
    await expect.poll(async () => {
      const res = await page.request.post(`${buildUrl}/api/github/proxy`, {
        headers: { 'Content-Type': 'application/json' },
        data: { method: 'GET', url: `/repos/empirical-run/lorem-ipsum-tests/pulls/${prNumber}` }
      });
      const data = await res.json();
      return data.state;
    }, { message: 'PR should be closed', timeout: 15000, intervals: [2000] }).toBe('closed');
  });
});
