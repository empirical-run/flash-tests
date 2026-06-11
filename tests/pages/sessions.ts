import { createHmac } from 'crypto';
import { Locator, Page, expect, test } from '@playwright/test';

export type SandboxStatus = {
  sandboxId: string;
  provider: string;
  status?: string;
};

function parseWebSocketFramePayload(data: unknown): unknown {
  let payload = data;

  if (Buffer.isBuffer(payload)) {
    payload = payload.toString();
  }

  if (typeof payload === 'string') {
    payload = JSON.parse(payload);
  }

  if (payload && typeof payload === 'object' && 'payload' in payload) {
    const nestedPayload = (payload as { payload?: unknown }).payload;
    if (typeof nestedPayload === 'string') {
      return JSON.parse(nestedPayload);
    }
    return nestedPayload;
  }

  return payload;
}

function parseSandboxStatus(payload: unknown): SandboxStatus | undefined {
  if (!payload || typeof payload !== 'object') return undefined;

  const event = payload as Record<string, unknown>;
  if (event.type !== 'sandbox_status') return undefined;
  if (typeof event.sandbox_id !== 'string') return undefined;
  if (event.provider !== 'e2b' && event.provider !== 'docker' && event.provider !== 'vercel') return undefined;

  return {
    sandboxId: event.sandbox_id,
    provider: event.provider,
    status: typeof event.status === 'string' ? event.status : undefined,
  };
}

/**
 * Resolves with sandbox id/provider from the sandbox_status websocket event emitted
 * while a session sandbox is being created.
 *
 * Call this before creating or opening the session so the listener cannot miss the
 * initial sandbox_status frame.
 *
 * @param page    The Playwright page object
 * @param timeout Timeout in milliseconds (default: 120000)
 * @returns The sandbox id/provider from the websocket event
 */
export async function waitForSandboxStatusFromWebSocket(page: Page, timeout = 120000): Promise<SandboxStatus> {
  return new Promise((resolve, reject) => {
    const webSockets: Array<{
      off: (event: 'framereceived', listener: (data: unknown) => void) => void;
      listener: (data: unknown) => void;
    }> = [];

    const cleanup = () => {
      clearTimeout(timer);
      page.off('websocket', onWebSocket);
      for (const webSocket of webSockets) {
        webSocket.off('framereceived', webSocket.listener);
      }
    };

    const handleFrame = (data: unknown) => {
      const sandboxStatus = parseSandboxStatus(parseWebSocketFramePayload(data));
      if (!sandboxStatus) return;

      cleanup();
      resolve(sandboxStatus);
    };

    const onWebSocket = (webSocket: {
      url: () => string;
      on: (event: 'framereceived', listener: (data: unknown) => void) => void;
      off: (event: 'framereceived', listener: (data: unknown) => void) => void;
    }) => {
      if (!webSocket.url().includes('pi-worker')) return;

      const listener = (data: unknown) => handleFrame(data);
      webSockets.push({ off: webSocket.off.bind(webSocket), listener });
      webSocket.on('framereceived', listener);
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting ${timeout}ms for sandbox_status websocket event`));
    }, timeout);

    page.on('websocket', onWebSocket);
  });
}

function decodeBase32(secret: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalizedSecret = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';

  for (const character of normalizedSecret) {
    const value = alphabet.indexOf(character);
    if (value === -1) {
      throw new Error(`Invalid base32 character in TOTP secret: ${character}`);
    }
    bits += value.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateInternalAuthTOTP(secret: string): string {
  const counter = Math.floor(Date.now() / 1000 / 180);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha256', decodeBase32(secret)).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];

  return (code % 1_000_000).toString().padStart(6, '0');
}

/**
 * Pauses a sandbox through the dashboard's internal sandbox route.
 *
 * @param page          The Playwright page object
 * @param sandboxStatus Sandbox id/provider captured from sandbox_status websocket event
 */
export async function pauseSandbox(page: Page, sandboxStatus: SandboxStatus): Promise<void> {
  const totpSecret = process.env.EMPIRICAL_TOTP_SK;
  expect(totpSecret, 'EMPIRICAL_TOTP_SK is required to authenticate /api/internal/sandbox').toBeTruthy();

  const response = await page.request.post('/api/internal/sandbox', {
    headers: {
      'Content-Type': 'application/json',
      'X-Empirical-Auth-TOTP': generateInternalAuthTOTP(totpSecret!),
    },
    data: {
      action: 'pause',
      sandbox_id: sandboxStatus.sandboxId,
      provider: sandboxStatus.provider,
    },
  });

  const responseBody = await response.text();
  expect(response.ok(), `Pause sandbox API failed with ${response.status()}: ${responseBody}`).toBeTruthy();
}

/**
 * Expands the "Tool Output" accordion section in the tool detail panel and returns
 * a locator scoped to the expanded section, ready for assertions.
 *
 * Assumes the page has a tool detail panel open with a "Tool Output" button visible.
 *
 * @param page The Playwright page object
 * @returns A locator scoped to the Tool Output section (parent of the button)
 */
export async function expandToolOutput(page: Page): Promise<Locator> {
  const button = page.getByRole('button', { name: 'Tool Output' });
  await button.click();
  return button.locator('xpath=..');
}

/**
 * Opens the session info panel by clicking the "Show session info" button.
 * Playwright auto-waits for the button to be visible before clicking.
 *
 * Assumes the page is already on a session detail page.
 *
 * @param page The Playwright page object
 */
export async function openSessionInfoPanel(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Show session info' }).click();
}

/**
 * Navigates to the session Details tab and extracts branch names from the GitHub compare link.
 *
 * Assumes the page is already on a session detail page with a compare link visible.
 *
 * @param page The Playwright page object
 * @returns An object with { baseBranch, headBranch } extracted from the compare URL
 */
export async function getSessionBranchNames(page: Page): Promise<{ baseBranch: string; headBranch: string }> {
  await openSessionInfoPanel(page);
  const branchLink = page.locator('a[href*="compare/"]').first();
  await expect(branchLink).toBeVisible();
  const href = await branchLink.getAttribute('href');
  const compareParams = href?.split('/compare/')[1];
  const baseBranch = compareParams?.split('...')[0] ?? '';
  const headBranch = compareParams?.split('...')[1] ?? '';
  // Close the panel so it doesn't interfere with subsequent assertions
  await page.getByRole('button', { name: 'Show session info' }).click();
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
 * Fills the initial prompt and submits an already-open new session dialog.
 *
 * Assumes the Create new session dialog is already open.
 *
 * @param page   The Playwright page object
 * @param prompt The initial prompt to fill in
 */
export async function submitNewSessionDialog(page: Page, prompt: string): Promise<void> {
  await page.getByPlaceholder('Enter an initial prompt or drag and drop a file here').fill(prompt);
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
  await page.getByRole('combobox').filter({ hasText: 'All users' }).click();
  await expect(page.getByRole('option', { name: 'Select all' })).toBeVisible();
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
  await expect(page.getByRole('button', { name: 'Running', exact: true })).toBeVisible({ timeout });
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
 * Opens the Review panel by clicking the Review button and returns the review dialog element.
 *
 * Assumes the page is already on a session detail page.
 *
 * @param page The Playwright page object
 * @returns The review dialog locator
 */
export async function openReviewPanel(page: Page) {
  await page.getByRole('button', { name: 'Review' }).first().click();
  return page.getByRole('dialog');
}

/**
 * Waits for the PR button (e.g. "PR #42") to become visible in the session header.
 * The button appears once a pull request has been created or detected for the session.
 *
 * Assumes the page is already on a session detail page.
 *
 * @param page    The Playwright page object
 * @param timeout Timeout in milliseconds (default: 25000)
 * @returns The PR button locator (already verified visible)
 */
export async function waitForPRButton(page: Page, timeout = 25000): Promise<Locator> {
  const prButton = page.getByRole('button', { name: /PR #\d+/ });
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
  await openSessionInfoPanel(page);
  const prButton = await waitForPRButton(page, 15000);
  const prButtonText = await prButton.textContent();
  const prNumber = prButtonText?.match(/PR #(\d+)/)?.[1];
  expect(prNumber).toBeTruthy();
  await page.getByRole('button', { name: 'Review' }).click();
  await page.getByRole('button', { name: 'Merge PR' }).click();
  await page.getByRole('button', { name: 'Merge PR' }).click();
  await page.waitForTimeout(3000);
  return prNumber;
}
