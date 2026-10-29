import type { Page } from "@playwright/test";

/**
 * All flash tests share one automation user, so every parallel agent session
 * that pauses for input raises a "Needs your input" toast in *every* open
 * dashboard tab. The Sonner stack sits top-right in the `Notifications alt+T`
 * top-layer region (outside any modal's aria-hidden scope) and intercepts
 * clicks on controls underneath it, e.g. the commit review sheet's Close and
 * the live browser's "Minimize to preview".
 *
 * This registers a Playwright locator handler that clicks the toast's own
 * Dismiss button whenever one is visible before an action (or an action
 * retry). Dismissing a toast does not close an open Radix sheet/dialog, so the
 * test still exercises the real control it targets. Only "Needs your input"
 * toasts are handled; error/success toasts that tests assert on are untouched.
 */
export async function dismissNeedsInputToastsWhenBlocking(page: Page) {
  const needsInputDismissButtons = page
    .getByRole("region", { name: "Notifications alt+T", exact: true })
    .getByRole("listitem")
    .filter({ has: page.getByText(/^Needs your input:/) })
    .getByRole("button", { name: "Dismiss", exact: true });

  await page.addLocatorHandler(
    needsInputDismissButtons.first(),
    async () => {
      // Toasts arrive, re-render and auto-remove on their own, so a locator
      // click here races the stack: a toast detached mid-click leaves the
      // click waiting for an element that never returns, and a throwing
      // handler fails whatever action/assertion triggered it. evaluateAll
      // neither waits nor throws when the stack is already empty, and
      // dismisses every current "Needs your input" toast in one pass through
      // the toast's own Dismiss button handler.
      await needsInputDismissButtons.evaluateAll((buttons) => {
        for (const button of buttons) (button as HTMLButtonElement).click();
      });
    },
    // New toasts can keep arriving from sibling sessions; don't wait for the
    // stack to be empty. Playwright re-checks before the next action/retry.
    { noWaitAfter: true },
  );
}
