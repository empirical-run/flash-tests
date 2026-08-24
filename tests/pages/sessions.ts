import { Locator, Page, expect, test } from '@playwright/test';
import { getApiWorkerAuthHeaders } from './api-auth';
import { getPrBaseBranch } from './github';
import { expectAppLoaded } from './home';
import { getApiBaseUrl } from './urls';

type MessageContentMatcher = string | RegExp;
type BashToolCallStatus = 'running' | 'used' | 'any';

function serializeMessageContentMatcher(matcher: MessageContentMatcher): { type: 'string'; value: string } | { type: 'regex'; source: string; flags: string } {
  if (typeof matcher === 'string') {
    return { type: 'string', value: matcher };
  }

  return { type: 'regex', source: matcher.source, flags: matcher.flags };
}

/**
 * Returns a locator for bash tool-call bubbles only.
 *
 * Chat message text can mention command snippets (for example, a user's original
 * prompt or the assistant's final summary), so tests that need to assert whether
 * a command actually ran should scope to the tool-call elements instead of using
 * broad page.getByText() matches across the whole transcript.
 *
 * @param page           The Playwright page object
 * @param commandMatcher Text/regex that should appear in the bash tool-call label
 * @param status         Tool-call status to match: running, used, or any
 */
export function getBashToolCall(page: Page, commandMatcher: MessageContentMatcher, status: BashToolCallStatus = 'any'): Locator {
  const selector = status === 'any'
    ? '[data-testid="running-bash"], [data-testid="used-bash"]'
    : `[data-testid="${status}-bash"]`;

  return page.locator(selector).filter({ hasText: commandMatcher });
}

/**
 * Returns a locator for a chat message bubble containing the given text/regex.
 *
 * Chat messages render with a `[data-message-id]` attribute; this scopes to those
 * containers and filters by the provided matcher. Use this instead of repeating the
 * raw `page.locator('[data-message-id]').filter(...)` chain across tests.
 *
 * @param page     The Playwright page object
 * @param text     Text or regex expected within the message bubble
 * @param position Which match to return when multiple bubbles match (default: 'first')
 * @returns A locator for the matching chat message bubble
 */
export function getChatMessageByText(page: Page, text: MessageContentMatcher, position: 'first' | 'last' = 'first'): Locator {
  const messages = page.locator('[data-message-id]').filter({ hasText: text });
  return position === 'last' ? messages.last() : messages.first();
}

/**
 * Asserts that messages containing the given text/regex matchers appear in order
 * across top-level chat message containers.
 *
 * This intentionally compares `[data-message-id]` containers instead of arbitrary
 * nested locators because a tool label or paragraph can be nested differently from
 * the visual chat message wrapper.
 *
 * @param page The Playwright page object
 * @param matchers Text or regex matchers expected in message order
 * @param timeout Max time to wait for the ordered messages
 */
export async function expectMessageContentsInDocumentOrder(page: Page, matchers: MessageContentMatcher[], timeout = 30000): Promise<void> {
  const serializedMatchers = matchers.map(serializeMessageContentMatcher);

  await expect.poll(async () => {
    return page.locator('[data-message-id]').evaluateAll((messageElements, expectedMessages) => {
      const messageIndexes = expectedMessages.map(expectedMessage => {
        return messageElements.findIndex(messageElement => {
          const text = messageElement.textContent || '';

          if (expectedMessage.type === 'string') {
            return text.includes(expectedMessage.value);
          }

          return new RegExp(expectedMessage.source, expectedMessage.flags).test(text);
        });
      });

      return messageIndexes.every((messageIndex, index) => {
        return messageIndex >= 0 && (index === 0 || messageIndex > messageIndexes[index - 1]);
      });
    }, serializedMatchers);
  }, { timeout }).toBe(true);
}

/**
 * Returns the details for the currently selected tool call.
 *
 * Most tools render details inline below their marker. Tools that include code
 * changes still use the side panel, so this helper supports both app variants.
 */
export async function getToolDetails(page: Page): Promise<Locator> {
  const inlineDetails = page.getByTestId('inline-tool-details').last();
  const sidePanelDetails = page.getByRole('button', { name: 'Tool Input' }).locator('xpath=../..').first();

  await expect(inlineDetails.or(sidePanelDetails)).toBeVisible();
  return await inlineDetails.isVisible() ? inlineDetails : sidePanelDetails;
}

/**
 * Returns a section from the currently selected tool details.
 *
 * Inline details expose Input and Output as headings. The code-changes side
 * panel retains accordion buttons, which must be expanded before assertions.
 */
async function getToolSection(page: Page, sectionName: 'Input' | 'Output'): Promise<Locator> {
  const details = await getToolDetails(page);
  const inlineHeading = details.getByRole('heading', { name: sectionName, exact: true });
  const accordionButton = details.getByRole('button', { name: `Tool ${sectionName}`, exact: true });

  await expect(inlineHeading.or(accordionButton)).toBeVisible();
  if (await accordionButton.isVisible()) {
    await accordionButton.click();
    return accordionButton.locator('..');
  }

  return inlineHeading.locator('..');
}

export async function getToolInput(page: Page): Promise<Locator> {
  return getToolSection(page, 'Input');
}

export async function getToolOutput(page: Page): Promise<Locator> {
  return getToolSection(page, 'Output');
}

/**
 * Asserts that the session was created by the given user.
 *
 * The session header no longer shows an inline "(by <name>)" text label next to
 * the title. Instead, the creator is shown as an avatar in the header; hovering
 * over it reveals a tooltip with the creator's identity (display name, or email
 * when no display name is set).
 *
 * Assumes the page is already on a session detail page.
 *
 * @param page     The Playwright page object
 * @param identity The expected creator identity shown in the tooltip (name or email)
 */
export async function expectSessionCreatedBy(page: Page, identity: string): Promise<void> {
  const authorAvatar = page.locator('header [data-slot="tooltip-trigger"]').first();
  await authorAvatar.hover();
  await expect(page.getByRole('tooltip', { name: identity })).toBeVisible();
}

/**
 * Reads branch names from the current session resource.
 *
 * Branch metadata is no longer rendered in a session-info panel, so use the
 * same authenticated session endpoint that backs the detail page.
 *
 * @param page The Playwright page object
 * @returns An object with { baseBranch, headBranch }
 */
export async function getSessionBranchNames(page: Page): Promise<{ baseBranch: string; headBranch: string }> {
  const sessionId = getSessionIdFromUrl(page);
  const headers = await getApiWorkerAuthHeaders(page);
  const response = await page.request.get(`${getApiBaseUrl()}/api/chat-sessions/${sessionId}`, { headers });
  await expect(response).toBeOK();

  const body = await response.json();
  const session = body.data?.chat_session;
  expect(session?.base_branch).toBeTruthy();
  expect(session?.branch_name).toBeTruthy();

  return { baseBranch: session.base_branch, headBranch: session.branch_name };
}

/**
 * Asserts the configured base branch of the current session.
 *
 * @param page The Playwright page object
 * @param expectedBaseBranch The expected session base branch
 */
export async function expectSessionBaseBranch(page: Page, expectedBaseBranch: string): Promise<void> {
  const { baseBranch } = await getSessionBranchNames(page);
  expect(baseBranch).toBe(expectedBaseBranch);
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
  await expectAppLoaded(page);
  await page.getByRole('link', { name: 'Sessions', exact: true }).click();
  await expect(page).toHaveURL(/sessions$/);
}

/**
 * Waits for the first session link in the sidebar list to be visible, clicks it
 * to open the session, and returns the session ID extracted from its href.
 *
 * Assumes the sessions list is already displayed (e.g. after navigateToSessions
 * and/or filtering).
 *
 * @param page The Playwright page object
 * @returns The opened session's ID (from the link href), if present
 */
export async function openFirstSession(page: Page): Promise<string | undefined> {
  const firstSessionLink = page.locator('a[href*="/sessions/"]').first();
  await expect(firstSessionLink).toBeVisible({ timeout: 15000 });
  const sessionHref = await firstSessionLink.getAttribute('href');
  const sessionId = sessionHref?.split('/').pop();
  await firstSessionLink.click();
  return sessionId;
}

/**
 * Opens the new session creation dialog by clicking the + button.
 *
 * Assumes the page is already on the Sessions page.
 *
 * @param page The Playwright page object
 */
export async function openNewSessionDialog(page: Page): Promise<void> {
  // The app renders a hidden duplicate of the sessions sidebar for responsive
  // hydration. Scope to the active page content so the hidden duplicate + button
  // does not trigger a strict-mode violation on mobile.
  await page.locator('main button:has(svg.lucide-plus)').click();
}

/**
 * Returns the initial prompt input (tiptap editor) of the Create new session
 * dialog. Assumes the dialog is open.
 *
 * @param page The Playwright page object
 */
export function getNewSessionPromptInput(page: Page) {
  return page.getByPlaceholder('Enter an initial prompt or drag and drop a file here');
}

/**
 * Fills the initial prompt and submits an already-open new session dialog.
 *
 * Assumes the Create new session dialog is already open.
 *
 * @param page   The Playwright page object
 * @param prompt The initial prompt to fill in
 */
export async function submitNewSessionDialog(page: Page, prompt: string): Promise<void> {
  await getNewSessionPromptInput(page).fill(prompt);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page).toHaveURL(/sessions\/\d+/);
  test.info().annotations.push({ type: 'Session URL', description: page.url() });
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
  await submitNewSessionDialog(page, prompt);
}

/**
 * Filters the sessions list by a specific user via the Filters panel.
 * Opens the Filters panel, unchecks "Last 30 days only", selects the given user
 * from the "Created by" dropdown, closes the popover, and verifies the active
 * filter badge shows a count. The exact count varies by environment: production
 * shows "Filters 1", while environments with a default active-project filter show
 * "Filters 2", so we match either 1 or 2 (any other count is a regression).
 *
 * Assumes the page is already on the Sessions page.
 *
 * @param page     The Playwright page object
 * @param userName The display name of the user to filter by (e.g. 'Arjun Attam')
 */
export async function filterSessionsByUser(page: Page, userName: string): Promise<void> {
  await page.getByRole('button', { name: 'Filters' }).click();
  await page.getByRole('checkbox', { name: 'Last 30 days only' }).click();
  await page.getByRole('combobox').filter({ hasText: 'All users' }).click();
  await expect(page.getByRole('option', { name: userName })).toBeVisible();
  await page.getByRole('option', { name: userName }).click();
  await page.locator('body').click({ position: { x: 800, y: 400 } });
  await expect(page.getByRole('button', { name: /Filters [12]/ })).toBeVisible();
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
  await openNewSessionDialog(page);
  // The Advanced section toggle is not needed — the Base branch textbox is always present
  // in the DOM/accessibility tree even when the section is visually collapsed, so Playwright
  // can fill it directly. Clicking "Advanced" is also harmful when the section is already
  // expanded (e.g. on some builds), as it would collapse and hide the field.
  await page.getByRole('textbox', { name: 'staging' }).fill(branchName);
  await submitNewSessionDialog(page, prompt);
}

/**
 * Waits for the sandbox environment to be ready for the agent to act.
 *
 * The UI can move from "Setting up environment…" to "Running" before a test starts
 * waiting for the transient setup pill, especially when the sandbox is warm. Waiting
 * for the stable final "Running" state makes the helper robust to both cold and warm
 * sandbox startup paths.
 *
 * Assumes the page is already on a session detail page with a sandbox session.
 *
 * @param page    The Playwright page object
 * @param timeout Timeout in milliseconds for the ready-state assertion (default: 60000)
 */
export async function waitForSandboxEnvironment(page: Page, timeout = 60000): Promise<void> {
  await expect(page.getByRole('button', { name: 'Agent machine: Running', exact: true })).toBeVisible({ timeout });
}

/**
 * Verifies the sandbox health endpoint from the UI exposed on the Running pill.
 * Hovering over the Running status opens the sandbox popover; clicking
 * "Show health" calls `/api/chat-sessions/:id/sandbox/health` and renders
 * the response in a modal.
 *
 * Assumes the page is already on a session detail page with a running sandbox.
 *
 * @param page The Playwright page object
 */
export async function expectSandboxHealthEndpoint(page: Page): Promise<void> {
  const runningPill = page.getByRole('button', { name: 'Agent machine: Running', exact: true });
  await expect(runningPill).toBeVisible({ timeout: 60000 });
  await runningPill.hover();

  const showHealthButton = page.getByRole('button', { name: 'Show health', exact: true });
  await expect(showHealthButton).toBeVisible();

  const healthResponsePromise = page.waitForResponse(
    response => response.url().includes('/sandbox/health') && response.request().method() === 'GET',
    { timeout: 30000 }
  );

  await showHealthButton.click();

  const healthResponse = await healthResponsePromise;
  expect(healthResponse.status()).toBe(200);

  const healthDialog = page.getByRole('dialog', { name: 'Sandbox health' });
  await expect(healthDialog).toBeVisible();
  await expect(healthDialog.getByText('ok', { exact: true })).toBeVisible();

  await healthDialog.getByRole('button', { name: 'Close' }).click();
  await expect(healthDialog).toBeHidden();
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
  await page.getByRole('button', { name: /^Send/ }).click();
}

/**
 * Steers the currently running agent with a new instruction.
 * Fills the message input, clicks the Steer button, and asserts the
 * steered-message UI appears with the submitted instruction.
 *
 * Assumes the page is already on a session detail page with the agent running.
 *
 * @param page    The Playwright page object
 * @param message The steering instruction to send
 */
export async function steerMessage(page: Page, message: string): Promise<void> {
  const textbox = page.getByRole('textbox', { name: 'Type your message here...' });
  await textbox.click();
  await textbox.fill(message);
  await page.getByRole('button', { name: /^Steer/ }).click();
  const steeredMessagesPanel = page.locator('div.rounded-l-xl.rounded-tr-xl').filter({
    hasText: 'Steered messages',
  });
  await expect(steeredMessagesPanel).toBeVisible({ timeout: 15000 });
  await expect(steeredMessagesPanel.getByText(message)).toBeVisible();
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
 * Opens the chevron dropdown, clicks "Close Session", confirms the action, and
 * verifies the sandbox status indicator moves to the terminal "Killed" state.
 *
 * Assumes the page is already on the session detail page and remains there
 * after the close confirmation.
 *
 * @param page The Playwright page object
 */
export async function closeSession(page: Page): Promise<void> {
  await page.getByRole('button').filter({ hasText: 'Review' }).locator('..').locator('.lucide-chevron-down').click();
  await page.getByRole('menuitem', { name: 'Close Session' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByRole('button', { name: 'Agent machine: Killed', exact: true })).toBeVisible({ timeout: 60000 });
}

/**
 * Opens the Review panel by clicking the Review button and returns the review dialog element.
 *
 * Assumes the page is already on a session detail page.
 *
 * @param page The Playwright page object
 * @returns The review dialog locator
 */
export async function openReviewPanel(page: Page) {
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible' });
  return dialog;
}

/**
 * Waits for the agent to reach an idle state in the current session.
 * The agent shows a "Stop" button while it is running; this helper waits for that
 * button to disappear, which signals the agent has finished the current turn and
 * is waiting on user input.
 *
 * Unlike waitForAgentToFinish, this does NOT first wait for the Stop button to
 * appear — use it when the agent may already be idle (e.g. after a tool has
 * completed and you just need to confirm it's no longer running).
 *
 * Assumes the page is already on a session detail page.
 *
 * @param page    The Playwright page object
 * @param timeout Timeout in milliseconds for the agent to become idle (default: 60000)
 */
export async function waitForAgentIdle(page: Page, timeout = 60000): Promise<void> {
  await expect(page.getByRole('button', { name: /^Stop/ })).toBeHidden({ timeout });
}

/**
 * Waits for the agent to finish responding in the current session.
 * The agent shows a "Stop" button while it is running; this helper first waits for
 * that button to appear (agent started working) and then for it to disappear
 * (agent reached an idle state and is waiting on user input).
 *
 * Assumes the page is already on a session detail page with a message just sent.
 *
 * @param page    The Playwright page object
 * @param timeout Timeout in milliseconds for the agent to finish (default: 300000)
 */
export async function waitForAgentToFinish(page: Page, timeout = 300000): Promise<void> {
  // Agent should start running first (Stop button appears while it works)
  await expect(page.getByRole('button', { name: /^Stop/ })).toBeVisible({ timeout: 60000 });
  // Then it finishes and reaches an idle state (Stop button disappears)
  await waitForAgentIdle(page, timeout);
}

/**
 * Waits for the PR button (e.g. "Review PR #42") to become visible in the session header.
 * The button appears once a pull request has been created or detected for the session.
 *
 * Scoped to `main header` (the session header, the only <header> inside <main>).
 * Its visible label is "Review", while its accessible name includes the PR number
 * (for example, "Review PR #42").
 *
 * Assumes the page is already on a session detail page.
 *
 * @param page    The Playwright page object
 * @param timeout Timeout in milliseconds (default: 25000)
 * @returns The PR button locator (already verified visible)
 */
export async function waitForPRButton(page: Page, timeout = 25000): Promise<Locator> {
  const prButton = page.locator('main header').getByRole('button', { name: /PR #\d+/ });
  await expect(prButton.first()).toBeVisible({ timeout });
  return prButton;
}

/**
 * Extracts the session ID from the current page URL.
 * Asserts that a valid session ID was found before returning.
 *
 * Assumes the page is already on a session detail URL of the form `/sessions/<id>`.
 *
 * @param page The Playwright page object
 * @returns The session ID string extracted from the URL
 */
export function getSessionIdFromUrl(page: Page): string {
  const sessionUrl = page.url();
  const sessionIdMatch = sessionUrl.match(/\/sessions\/([^?&#/]+)/);
  const sessionId = sessionIdMatch?.[1];
  if (!sessionId) throw new Error(`Could not extract session ID from URL: ${sessionUrl}`);
  return sessionId;
}

/**
 * Asserts that the session header reflects a merged PR: the "Merged" button is
 * visible and no "PR #<n>" (review) button remains in the header.
 *
 * This is a regression guard for a bug where the GitHub `pull_request(merged)`
 * webhook handler threw while upserting the pull_requests row (a raw JS Date was
 * interpolated into a `sql\`COALESCE(merged_at, ${date})\`` template, which
 * postgres.js rejects). Because the handler runs in `waitUntil`, the merge
 * request still returned 200, but `chat_sessions.pr_status` never advanced to
 * "merged" — so the header kept showing the "Review PR #<n>" button (which
 * matches /PR #\d+/) instead of flipping to "Merged". See test-generator#6714.
 *
 * Scoped to `main header` (the session header), which is the only <header> inside
 * <main>; the top navigation banner is a separate top-level <header>.
 *
 * IMPORTANT: the Review dialog must be closed before calling this. While that
 * Radix dialog is open it marks the rest of the page inert/aria-hidden, so
 * getByRole cannot see the header button behind it.
 *
 * Assumes the page is on a session detail page whose PR was just merged, with the
 * Review dialog closed.
 *
 * @param page    The Playwright page object
 * @param timeout Timeout in milliseconds for the "Merged" state to appear (default: 30000)
 */
export async function expectSessionPrMerged(page: Page, timeout = 30000): Promise<void> {
  const sessionHeader = page.locator('main header');
  await expect(sessionHeader.getByRole('button', { name: 'Merged' })).toBeVisible({ timeout });
  await expect(sessionHeader.getByRole('button', { name: /PR #\d+/ })).toHaveCount(0);
}

/**
 * Merges the open PR associated with the current session via the Review UI.
 * Waits for the header Review button, extracts its PR number, opens the Review
 * dialog directly, and confirms the Merge PR action.
 *
 * After merging, asserts the session header transitions to the merged state via
 * expectSessionPrMerged (the "Merged" button appears and no "PR #<n>" button
 * remains). This catches the regression fixed in test-generator#6714.
 *
 * Assumes the page is already on the session detail page with an open PR.
 *
 * Guardrails: this rejects known shared branch names up front, then asserts the
 * PR's actual base branch equals `expectedBaseBranch` (the throwaway branch the
 * test created). This prevents both an unsafe caller and a session that silently
 * fell back to its default base (e.g. "staging") from merging a destructive PR
 * (like a file deletion) straight into a shared branch.
 *
 * @param page The Playwright page object
 * @param expectedBaseBranch The throwaway base branch the PR must target before merging
 * @returns The PR number string that was merged (e.g. "42")
 */
export async function mergePrFromSession(page: Page, expectedBaseBranch: string): Promise<string | undefined> {
  const sharedBranches = ['main', 'master', 'staging', 'default'];
  if (sharedBranches.includes(expectedBaseBranch.toLowerCase())) {
    throw new Error(`Refusing to merge a session PR into shared branch "${expectedBaseBranch}"`);
  }

  const prButton = await waitForPRButton(page, 15000);
  const prButtonText = await prButton.first().textContent();
  const prNumber = prButtonText?.match(/PR #(\d+)/)?.[1];
  expect(prNumber).toBeTruthy();

  // Guardrail: verify the PR targets the throwaway branch before merging.
  const actualBaseBranch = await getPrBaseBranch(page, Number(prNumber));
  expect(
    actualBaseBranch,
    `Refusing to merge PR #${prNumber} — base is "${actualBaseBranch}", expected throwaway branch "${expectedBaseBranch}"`
  ).toBe(expectedBaseBranch);

  await prButton.first().click();
  await page.getByRole('button', { name: 'Merge PR' }).click();
  await page.getByRole('button', { name: 'Merge PR' }).click();

  // Close the Review dialog so the session header becomes observable again — while
  // the dialog is open Radix marks the background inert/aria-hidden, hiding the
  // header's PR/Merged button from the accessibility tree.
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  // The merge webhook updates pr_status asynchronously (waitUntil), so poll the
  // header for the merged state instead of a fixed sleep.
  await expectSessionPrMerged(page, 45000);
  return prNumber;
}
