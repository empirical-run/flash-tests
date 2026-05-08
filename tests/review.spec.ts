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

  // Open the latest string replace tool call - clicking the bubble opens the side panel directly
  await page.getByText(/Edited .+/).first().click();

  // The right panel contains a split/unified toggle in the Code Changes section.
  // Use a filter to find specifically the tablist that contains the split trigger,
  // since the panel now also has a separate 'Details' header tablist.
  const toolTablist = page.getByRole('tablist').filter({ has: page.locator('[id*="trigger-split"]') });
  await expect(toolTablist).toBeVisible();

  const tab0 = toolTablist.getByRole('tab').first();
  const tab1 = toolTablist.getByRole('tab').nth(1);

  const isSelected = async (locator: any) => {
    return await locator.first().evaluate((el: Element) => {
      const ariaSelected = el.getAttribute('aria-selected');
      const ariaPressed = el.getAttribute('aria-pressed');
      const dataState = el.getAttribute('data-state');
      return ariaSelected === 'true' || ariaPressed === 'true' || dataState === 'active' || dataState === 'on';
    });
  };

  // Record the review sheet's initial mode BEFORE changing anything in the tool panel
  const sheet = await openReviewPanel(page);
  const diffTab = sheet.getByRole('tab', { name: 'Diff' });
  if (await diffTab.isVisible()) {
    await diffTab.click();
  }
  const sheetUnified = sheet.locator('[id*="trigger-unified"]');
  const sheetSplit = sheet.locator('[id*="trigger-split"]');
  const initialSheetIsUnified = await isSelected(sheetUnified);
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  // Record which tool panel tab is initially selected
  const tab0InitiallySelected = await isSelected(tab0);

  // Change the tool panel to the OPPOSITE tab
  if (tab0InitiallySelected) {
    await tab1.click();
    await expect.poll(async () => await isSelected(tab1)).toBeTruthy();
  } else {
    await tab0.click();
    await expect.poll(async () => await isSelected(tab0)).toBeTruthy();
  }

  // Open the review sheet and verify tool panel → sheet sync
  const sheet2 = await openReviewPanel(page);
  if (await diffTab.isVisible()) {
    await diffTab.click();
  }
  const sheetIsUnifiedAfterToolChange = await isSelected(sheetUnified);

  // STRONG ASSERTION 1 (tool panel → sheet sync):
  // Switching to the opposite tab in the tool panel must flip the sheet's mode.
  // e.g. if sheet started in split, it should now show unified, and vice versa.
  expect(sheetIsUnifiedAfterToolChange).toBe(!initialSheetIsUnified);

  // Change the review sheet back to the original mode to test the reverse direction
  if (initialSheetIsUnified) {
    await sheetUnified.first().click();
    await expect.poll(async () => await isSelected(sheetUnified)).toBeTruthy();
  } else {
    await sheetSplit.first().click();
    await expect.poll(async () => await isSelected(sheetSplit)).toBeTruthy();
  }

  // Close review sheet
  await page.keyboard.press('Escape');
  await expect(sheet2).toBeHidden();

  // Force re-render: navigate to a different tool and back to refresh the Code Changes panel
  // (equivalent to the old "Details → Tools" tab navigation that forced a re-render)
  await page.getByText(/Viewed .+/).last().click();
  await page.getByText(/Edited .+/).first().click();

  // Re-scope locators after re-opening the tool panel
  const refreshedTablist = page.getByRole('tablist').filter({ has: page.locator('[id*="trigger-split"]') });
  const refreshedTab0 = refreshedTablist.getByRole('tab').first();

  // STRONG ASSERTION 2 (sheet → tool panel sync):
  // We reverted the sheet to the original mode, so the tool panel must now show
  // the original tab selection — i.e. tab0 selected iff tab0 was initially selected.
  const tab0AfterSync = await isSelected(refreshedTab0);
  expect(tab0AfterSync).toBe(tab0InitiallySelected);
});

