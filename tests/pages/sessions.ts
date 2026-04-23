import { Page, expect } from '@playwright/test';

/**
 * Navigates to the session Details tab and extracts branch names from the GitHub compare link.
 *
 * Assumes the page is already on a session detail page with a compare link visible.
 *
 * @param page The Playwright page object
 * @returns An object with { baseBranch, headBranch } extracted from the compare URL
 */
export async function getSessionBranchNames(page: Page): Promise<{ baseBranch: string; headBranch: string }> {
  await page.getByRole('tab', { name: 'Details', exact: true }).click();
  const branchLink = page.locator('a[href*="compare/"]').first();
  await expect(branchLink).toBeVisible();
  const href = await branchLink.getAttribute('href');
  const compareParams = href?.split('/compare/')[1];
  const baseBranch = compareParams?.split('...')[0] ?? '';
  const headBranch = compareParams?.split('...')[1] ?? '';
  return { baseBranch, headBranch };
}

/**
 * Navigates to the Sessions page from the home page.
 * Starts at '/', waits for the app to load, clicks the Sessions nav link,
 * and waits for the sessions list URL.
 *
 * Assumes the user is already logged in (auth state is set up).
 *
 * @param page The Playwright page object
 */
export async function navigateToSessions(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByText('Lorem Ipsum', { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Sessions', exact: true }).click();
  await expect(page).toHaveURL(/sessions$/);
}

/**
 * Opens the new session creation dialog by clicking the + button.
 *
 * Assumes the page is already on the Sessions page.
 *
 * @param page The Playwright page object
 */
export async function openNewSessionDialog(page: Page): Promise<void> {
  await page.locator('button:has(svg.lucide-plus)').click();
}

/**
 * Creates a new session from the Sessions page by clicking the + button,
 * filling in the initial prompt, and clicking Create.
 *
 * Assumes the page is already on the Sessions page.
 *
 * @param page   The Playwright page object
 * @param prompt The initial prompt to fill in
 */
export async function createSession(page: Page, prompt: string): Promise<void> {
  await openNewSessionDialog(page);
  await page.getByPlaceholder('Enter an initial prompt or drag and drop a file here').fill(prompt);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page).toHaveURL(/sessions\/[^\/]+/);
}

/**
 * Filters the sessions list by a specific user via the Filters panel.
 * Opens the Filters panel, unchecks "Last 30 days only", selects the given user
 * from the "Created by" dropdown, closes the popover, and verifies the active
 * filter badge shows "Filters 1".
 *
 * Assumes the page is already on the Sessions page.
 *
 * @param page     The Playwright page object
 * @param userName The display name of the user to filter by (e.g. 'Arjun Attam')
 */
export async function filterSessionsByUser(page: Page, userName: string): Promise<void> {
  await page.getByRole('button', { name: 'Filters' }).click();
  await page.getByRole('checkbox', { name: 'Last 30 days only' }).click();
  await page.getByRole('button', { name: 'All users' }).click();
  await expect(page.getByRole('option', { name: '(Select All)' })).toBeVisible();
  await page.getByRole('option', { name: userName }).click();
  await page.locator('body').click({ position: { x: 800, y: 400 } });
  await expect(page.getByRole('button', { name: /Filters 1/ })).toBeVisible();
}

/**
 * Creates a new session with a custom base branch via the Advanced settings panel.
 * Clicks the + button, expands Advanced settings, fills in the base branch and prompt,
 * clicks Create, and waits for the session URL.
 *
 * Assumes the page is already on the Sessions page.
 *
 * @param page       The Playwright page object
 * @param prompt     The initial prompt to fill in
 * @param branchName The base branch name to set (replaces the default "staging" placeholder)
 */
export async function createSessionWithBranch(page: Page, prompt: string, branchName: string): Promise<void> {
  await page.locator('button:has(svg.lucide-plus)').click();
  await page.getByRole('button', { name: 'Advanced' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('textbox', { name: 'staging' }).fill(branchName);
  await page.getByPlaceholder('Enter an initial prompt or drag and drop a file here').fill(prompt);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page).toHaveURL(/sessions\//);
}

/**
 * Waits for the first chat message to appear in the session.
 * Uses a 30-second timeout to account for session initialization time.
 *
 * Assumes the page is already on a session detail page.
 *
 * @param page The Playwright page object
 */
export async function waitForFirstMessage(page: Page): Promise<void> {
  await expect(page.locator('[data-message-id]').first()).toBeVisible({ timeout: 30000 });
}

/**
 * Sends a message in the active session chat by typing it in the message input
 * and clicking the Send button.
 *
 * Assumes the page is already on a session detail page with the chat interface visible.
 *
 * @param page    The Playwright page object
 * @param message The message text to send
 */
export async function sendMessage(page: Page, message: string): Promise<void> {
  const textbox = page.getByRole('textbox', { name: 'Type your message here...' });
  await textbox.click();
  await textbox.fill(message);
  await page.getByRole('button', { name: 'Send' }).click();
}

/**
 * Queues a message while the agent is running a tool.
 * Fills the message input, clicks the Queue button, and asserts that
 * the Queue button becomes disabled and the input is cleared.
 *
 * Assumes the page is already on a session detail page with a tool actively running.
 *
 * @param page    The Playwright page object
 * @param message The message text to queue
 */
export async function queueMessage(page: Page, message: string): Promise<void> {
  const textbox = page.getByRole('textbox', { name: 'Type your message here...' });
  await textbox.click();
  await textbox.fill(message);
  await page.getByRole('button', { name: 'Queue', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Queue', exact: true })).toBeDisabled();
  await expect(textbox).toHaveText('');
}

/**
 * Closes the current session via the dropdown menu next to the "Review" button.
 * Opens the chevron dropdown, clicks "Close Session", and confirms the action.
 *
 * Assumes the page is already on the session detail page.
 *
 * @param page The Playwright page object
 */
export async function closeSession(page: Page): Promise<void> {
  await page.getByRole('button').filter({ hasText: 'Review' }).locator('..').locator('.lucide-chevron-down').click();
  await page.getByRole('menuitem', { name: 'Close Session' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
}

/**
 * Merges the open PR associated with the current session via the Details tab UI.
 * Clicks the Details tab, waits for the PR button to appear, extracts the PR number,
 * then opens the Review panel and confirms the Merge PR action.
 *
 * Assumes the page is already on the session detail page with an open PR.
 *
 * @param page The Playwright page object
 * @returns The PR number string that was merged (e.g. "42")
 */
export async function mergePrFromSession(page: Page): Promise<string | undefined> {
  await page.getByRole('tab', { name: 'Details', exact: true }).click();
  await expect(page.getByRole('button', { name: /^PR #\d+$/ })).toBeVisible({ timeout: 15000 });
  const prButton = page.getByRole('button', { name: /^PR #\d+$/ });
  const prButtonText = await prButton.textContent();
  const prNumber = prButtonText?.match(/PR #(\d+)/)?.[1];
  expect(prNumber).toBeTruthy();
  console.log(`PR Number: ${prNumber}`);
  await page.getByRole('button', { name: 'Review' }).click();
  await page.getByRole('button', { name: 'Merge PR' }).click();
  await page.getByRole('button', { name: 'Merge PR' }).click();
  await page.waitForTimeout(3000);
  return prNumber;
}
