import { test, expect } from "./fixtures";

// This test verifies that the diff view mode selection persists after a page reload
// and re-opening the Review sheet. We focus on persistence across reloads.
test("diff view preference persists across different components and page reloads", async ({ page, trackCurrentSession }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");

  // Go to Sessions
  await page.getByRole('link', { name: 'Sessions', exact: true }).click();

  // Create a new session so the Review sheet is available
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('button', { name: 'Create' }).click();

  // Verify we're in a session and track it for automatic cleanup
  await expect(page).toHaveURL(/\/sessions\//, { timeout: 10000 });
  trackCurrentSession(page);

  // Open Review sheet
  await page.getByText('Review').click();

  // Ensure we are on the Diff tab (clicking Diff if necessary)
  const diffTab = page.getByRole('tab', { name: 'Diff' });
  if (await diffTab.isVisible()) {
    await diffTab.click();
  }

  // Select a specific view mode to test persistence: Unified
  // Use robust selectors that match Radix tab/toggle triggers if present
  const unifiedTrigger = page.locator('[id*="trigger-unified"]');
  const splitTrigger = page.locator('[id*="trigger-split"]');

  // If Split is currently selected, switch to Unified to ensure a change
  if (await splitTrigger.first().isVisible()) {
    // Prefer clicking Unified explicitly
    await unifiedTrigger.first().click();
  } else {
    // Fallback: click Unified button/tab by accessible name if available
    const unifiedByRole = page.getByRole('button', { name: /unified/i }).or(page.getByRole('tab', { name: /unified/i }));
    await unifiedByRole.click();
  }

  // Helper to check if a view mode trigger is selected via common attributes
  const isSelected = async (locator: any) => {
    return await locator.first().evaluate((el: Element) => {
      const ariaSelected = el.getAttribute('aria-selected');
      const ariaPressed = el.getAttribute('aria-pressed');
      const dataState = el.getAttribute('data-state');
      return ariaSelected === 'true' || ariaPressed === 'true' || dataState === 'active' || dataState === 'on';
    });
  };

  // Assert Unified is selected before reload
  await expect.poll(async () => await isSelected(unifiedTrigger)).toBeTruthy();

  // Reload the page
  await page.reload();

  // Re-open Review sheet and go to Diff tab again
  await page.getByText('Review').click();
  if (await diffTab.isVisible()) {
    await diffTab.click();
  }

  // Verify the Unified selection persisted
  await expect.poll(async () => await isSelected(unifiedTrigger)).toBeTruthy();
});
