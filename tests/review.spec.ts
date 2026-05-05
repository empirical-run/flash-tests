import { test, expect } from "./fixtures";
import { openReviewPanel } from "./pages/sessions";

// Global test configuration for a fixed, read-only session to verify diff view mode persistence
const TEST_SESSION_ID = "5634";
const REPO_SLUG = "lorem-ipsum";

// This test verifies that the diff view mode selection persists after a page reload
// and re-opening the Review sheet. We focus on persistence across reloads, using a
// known session instead of creating a new one.
test("diff view preference persists across different components and page reloads", async ({ page }) => {
  // Navigate directly to the specific session
  await page.goto(`/${REPO_SLUG}/sessions/${TEST_SESSION_ID}`);

  // Open Review sheet from the top navigation
  await openReviewPanel(page);

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
  await openReviewPanel(page);
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

  // Open the latest string replace tool call (partial match for robustness) - clicking the bubble opens the side panel directly
  await page.getByText(/Edited .+/).first().click();

  // The right panel (outside dialog) has exactly one tablist: the split/unified toggle in Code Changes
  // Use it to determine current mode in the tool panel
  const toolTablist = page.getByRole('tablist').first();
  const toolUnified = toolTablist.getByRole('tab').first();  // unified = first tab
  const toolSplit = toolTablist.getByRole('tab').nth(1);     // split = second tab

  const isSelected = async (locator: any) => {
    return await locator.first().evaluate((el: Element) => {
      const ariaSelected = el.getAttribute('aria-selected');
      const ariaPressed = el.getAttribute('aria-pressed');
      const dataState = el.getAttribute('data-state');
      return ariaSelected === 'true' || ariaPressed === 'true' || dataState === 'active' || dataState === 'on';
    });
  };

  // Determine tool mode; if neither appears selected, set to unified as a deterministic baseline
  let toolIsUnified = await isSelected(toolUnified);
  let toolIsSplit = await isSelected(toolSplit);
  if (!toolIsUnified && !toolIsSplit) {
    await toolUnified.first().click();
    await expect.poll(async () => await isSelected(toolUnified)).toBeTruthy();
    toolIsUnified = true;
    toolIsSplit = false;
  }

  // Open Review sheet and go to Diff tab (scoped within dialog)
  const sheet = await openReviewPanel(page);
  const diffTab = sheet.getByRole('tab', { name: 'Diff' });
  if (await diffTab.isVisible()) {
    await diffTab.click();
  }

  // Sheet toggles (scoped to dialog)
  const sheetUnified = sheet.locator('[id*="trigger-unified"]');
  const sheetSplit = sheet.locator('[id*="trigger-split"]');

  // Read sheet mode
  const sheetIsUnified = await isSelected(sheetUnified);
  const sheetIsSplit = await isSelected(sheetSplit);

  // Reconcile initial mismatch if any: align sheet to tool mode first
  if (toolIsUnified && !sheetIsUnified) {
    await sheetUnified.first().click();
    await expect.poll(async () => await isSelected(sheetUnified)).toBeTruthy();
  } else if (toolIsSplit && !sheetIsSplit) {
    await sheetSplit.first().click();
    await expect.poll(async () => await isSelected(sheetSplit)).toBeTruthy();
  }

  // Now toggle to the opposite in the sheet
  if (toolIsUnified) {
    await sheetSplit.first().click();
    await expect.poll(async () => await isSelected(sheetSplit)).toBeTruthy();
  } else {
    await sheetUnified.first().click();
    await expect.poll(async () => await isSelected(sheetUnified)).toBeTruthy();
  }

  // Close Review sheet with Escape, then ensure dialog is hidden
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  // Force re-render by navigating to a different tool and back (replaces old "Details → Tools" navigation)
  // Click "Viewed README.md" (the previous tool) to switch the panel view
  await page.getByText(/Viewed .+/).last().click();
  // Then click back to "Edited README.md" to refresh the Code Changes panel with updated preference
  await page.getByText(/Edited .+/).first().click();

  // Re-scope locators after re-opening the tool panel
  const refreshedTablist = page.getByRole('tablist').first();
  const refreshedUnified = refreshedTablist.getByRole('tab').first();  // unified = first tab
  const refreshedSplit = refreshedTablist.getByRole('tab').nth(1);     // split = second tab

  // Return to tool panel and assert it reflects the updated mode
  if (toolIsUnified) {
    // We switched sheet to Split, so tool should now be Split
    await expect.poll(async () => await isSelected(refreshedSplit)).toBeTruthy();
  } else {
    // We switched sheet to Unified, so tool should now be Unified
    await expect.poll(async () => await isSelected(refreshedUnified)).toBeTruthy();
  }
});

