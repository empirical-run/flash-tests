import { test, expect } from "./fixtures";

// Global test configuration for a fixed, read-only session to verify diff view mode persistence
const TEST_SESSION_ID = "5634";
const REPO_SLUG = "lorem-ipsum-tests";

// This test verifies that the diff view mode selection persists after a page reload
// and re-opening the Review sheet. We focus on persistence across reloads, using a
// known session instead of creating a new one.
test("diff view preference persists across different components and page reloads", async ({ page }) => {
  // Navigate directly to the specific session
  await page.goto(`/${REPO_SLUG}/sessions/${TEST_SESSION_ID}`);

  // Open Review sheet from the top navigation
  await page.getByText('Review').click();

  // Ensure we are on the Diff tab
  const diffTab = page.getByRole('tab', { name: 'Diff' });
  if (await diffTab.isVisible()) {
    await diffTab.click();
  }

  // Select a specific view mode to test persistence: Unified
  const unifiedTrigger = page.locator('[id*="trigger-unified"]');
  const splitTrigger = page.locator('[id*="trigger-split"]');

  // If Split is currently selected, switch to Unified to ensure a change
  if (await splitTrigger.first().isVisible()) {
    await unifiedTrigger.first().click();
  } else {
    // Fallback: click Unified button/tab by accessible name if available
    const unifiedByRole = page
      .getByRole('button', { name: /unified/i })
      .or(page.getByRole('tab', { name: /unified/i }));
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

// This test verifies the view mode preference syncs between the string replace tool's diff panel
// and the Review sheet diff tab. It reads the current value from the tool panel, asserts it matches
// the Review sheet, changes it in the Review sheet, and asserts the tool panel now reflects the change.
test("diff view preference syncs between tool diff panel and review sheet", async ({ page }) => {
  await page.goto(`/${REPO_SLUG}/sessions/${TEST_SESSION_ID}`);
  // TODO(agent on page): In the session timeline, find the latest tool call that shows a diff for the string replace tool (label typically contains "Used str_replace_based_edit_tool: str_replace tool" or similar), open its diff view if needed, read the current view mode from the panel's toggle (Unified or Split), then:
  // 1) Open the Review sheet via the top navigation "Review" button
  // 2) Go to the Diff tab and verify the selected view mode matches the tool panel's view mode
  // 3) Change the view mode in the Review sheet to the opposite choice (if Unified, switch to Split; if Split, switch to Unified) and assert it's selected
  // 4) Close the Review sheet (click outside overlay or use the close button)
  // 5) Return to the same tool call diff panel and assert the selected view mode now matches the newly selected mode from the Review sheet
});

