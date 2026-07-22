import { test, expect } from "./fixtures";
import { openReviewPanel } from "./pages/sessions";

// Global test configuration for a fixed, read-only session to verify diff view mode persistence
const TEST_SESSION_ID = "5634";

// This test verifies that the diff view mode selection persists after a page reload
// and re-opening the Review sheet. We focus on persistence across reloads, using a
// known session instead of creating a new one.
test("diff view preference persists across different components and page reloads", async ({ page }) => {
  // Navigate directly to the specific session
  await page.goto(`/sessions/${TEST_SESSION_ID}`);

  // Open Review sheet from the top navigation
  await openReviewPanel(page);

  // Ensure we are on the Diff tab
  const diffTab = page.getByRole('tab', { name: 'Diff' });
  await diffTab.click();

  // Select the Unified view mode to test persistence
  const unifiedTrigger = page.locator('[id*="trigger-unified"]');
  await unifiedTrigger.first().click();

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

  // Reload the page. The Review sheet's open state is persisted in the URL
  // (`?review=diff`), so it re-opens automatically after the reload — assert it
  // is shown rather than clicking to open it again.
  await page.reload();
  await expect(page.getByRole('dialog')).toBeVisible();
  await diffTab.click();

  // Verify the Unified selection persisted
  await expect.poll(async () => await isSelected(unifiedTrigger)).toBeTruthy();
});

