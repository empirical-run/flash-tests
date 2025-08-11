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

  // Open the latest string replace tool call and ensure the Tools tab is active
  await page.getByText('Used str_replace_based_edit_tool: str_replace tool — in 14 secs').click();
  await page.getByRole('tab', { name: 'Tools' }).click();

  // Determine current mode in the tool panel (Unified/Split)
  const toolUnified = page.locator('[id*="trigger-unified"]');
  const toolSplit = page.locator('[id*="trigger-split"]');

  const isSelected = async (locator: any) => {
    return await locator.first().evaluate((el: Element) => {
      const ariaSelected = el.getAttribute('aria-selected');
      const ariaPressed = el.getAttribute('aria-pressed');
      const dataState = el.getAttribute('data-state');
      return ariaSelected === 'true' || ariaPressed === 'true' || dataState === 'active' || dataState === 'on';
    });
  };

  const toolIsUnified = await isSelected(toolUnified);

  // Open Review sheet and go to Diff tab
  await page.getByText('Review').click();
  const diffTab = page.getByRole('tab', { name: 'Diff' });
  if (await diffTab.isVisible()) {
    await diffTab.click();
  }

  // Sheet toggles
  const sheetUnified = page.locator('[id*="trigger-unified"]');
  const sheetSplit = page.locator('[id*="trigger-split"]');

  // Assert modes match initially
  if (toolIsUnified) {
    await expect.poll(async () => await isSelected(sheetUnified)).toBeTruthy();
  } else {
    await expect.poll(async () => await isSelected(sheetSplit)).toBeTruthy();
  }

  // Toggle to the opposite in the sheet
  if (toolIsUnified) {
    await sheetSplit.first().click();
    await expect.poll(async () => await isSelected(sheetSplit)).toBeTruthy();
  } else {
    await sheetUnified.first().click();
    await expect.poll(async () => await isSelected(sheetUnified)).toBeTruthy();
  }

  // Close sheet (click the overlay block or close button if present)
  // Prefer close button 'x' in the top-right of the sheet if available
  const closeButton = page.getByRole('button', { name: 'Close' }).or(page.locator('button:has-text("×")')); // best-effort
  if (await closeButton.first().isVisible()) {
    await closeButton.first().click();
  } else {
    // Fallback: click the overlay backdrop
    await page.locator('.fixed.inset-0.z-50').click({ position: { x: 10, y: 10 } });
  }

  // Return to tool panel and assert it reflects the updated mode
  if (toolIsUnified) {
    await expect.poll(async () => await isSelected(toolSplit)).toBeTruthy();
  } else {
    await expect.poll(async () => await isSelected(toolUnified)).toBeTruthy();
  }
});

