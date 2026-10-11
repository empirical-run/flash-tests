import type { Locator, Page } from '@playwright/test';

/** Visible completed discovery markers belonging only to the session's first user turn. */
export function getVisibleInitialDiscoveryTools(page: Page, prompt: string): Locator {
  const transcript = page.getByRole('region', { name: 'Messages', exact: true }).getByRole('log');
  const initialPrompt = transcript.locator('[data-slot="message-scroller-item"]').filter({
    has: page.locator('[data-slot="message"][data-align="end"]').getByText(prompt, { exact: true }),
  });
  // This is the initial turn: exactly one user row precedes its response rows.
  // A second user row closes that boundary, excluding all later tool calls.
  const response = initialPrompt.locator(
    'xpath=following-sibling::*[@data-slot="message-scroller-item" and not(.//*[@data-slot="message" and @data-align="end"]) and count(preceding-sibling::*[@data-slot="message-scroller-item"][.//*[@data-slot="message" and @data-align="end"]]) = 1]',
  );
  return response.locator(
    '[data-testid="used-ls"]:visible, [data-testid="used-shell"]:visible, [data-testid="used-bash"]:visible',
  ).filter({ hasText: /^\s*Used (?:ls|shell|bash)\b/i });
}
