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

  // Open the latest string replace tool call (partial match for robustness) and ensure the Tools tab is active
  await page.getByText('Used str_replace_based_edit_tool: str_replace tool', { exact: false }).first().click();
  await page.getByRole('tab', { name: 'Tools' }).click();

  // Scope to the Tools tabpanel to avoid interacting with sheet controls later
  const toolsPanel = page.getByRole('tabpanel', { name: 'Tools' });

  // Determine current mode in the tool panel (Unified/Split)
  const toolUnified = toolsPanel.locator('[id*="trigger-unified"]');
  const toolSplit = toolsPanel.locator('[id*="trigger-split"]');

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
  await page.getByText('Review').click();
  const sheet = page.getByRole('dialog');
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

  // Force the tool panel to re-render, then re-scope the locators
  await page.getByRole('tab', { name: 'Details' }).click();
  await page.getByRole('tab', { name: 'Tools' }).click();
  const refreshedToolsPanel = page.getByRole('tabpanel', { name: 'Tools' });
  const refreshedUnified = refreshedToolsPanel.locator('[id*="trigger-unified"]');
  const refreshedSplit = refreshedToolsPanel.locator('[id*="trigger-split"]');

  // Return to tool panel and assert it reflects the updated mode
  if (toolIsUnified) {
    // We switched sheet to Split, so tool should now be Split
    await expect.poll(async () => await isSelected(refreshedSplit)).toBeTruthy();
  } else {
    // We switched sheet to Unified, so tool should now be Unified
    await expect.poll(async () => await isSelected(refreshedUnified)).toBeTruthy();
  }
});

test("review functionality with tool execution and report details", async ({ page, trackCurrentSession }) => {
  // Navigate to sessions page and create a new session
  await page.goto('/');
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('button', { name: 'Create' }).click();
  
  // Verify we're in a session and track it for cleanup
  await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
  trackCurrentSession(page);

  // Send a message that triggers tools and file modification
  await page.getByRole('textbox', { name: 'Type your message here...' }).fill('run the test "has title" from tests/example.spec.ts and then add a comment to the beginning of that file');
  await page.getByRole('button', { name: 'Send' }).click();

  // Wait for tool execution to complete (any tool usage)
  await expect.poll(async () => {
    return await page.getByText(/Used.*tool/).isVisible();
  }, { timeout: 60000 }).toBeTruthy();

  // Wait a bit more for any additional tool execution to complete
  await page.waitForTimeout(5000);

  // Open the review UI by clicking on review button
  await page.getByRole('button', { name: 'Review' }).click();

  // Assert review dialog is visible
  const reviewDialog = page.locator('.session-review-dialog').or(page.getByRole('dialog'));
  await expect(reviewDialog).toBeVisible();

  // Navigate to Impacted Tests tab
  await page.getByRole('tab', { name: /Impacted Tests/ }).click();

  // Check if there are impacted tests or handle the case where there are none
  const impactedTestsTab = page.getByRole('tabpanel').filter({ hasText: /Impacted Tests/ });
  let hasImpactedTests = false;
  
  try {
    await expect.poll(async () => {
      const noTestsText = await impactedTestsTab.getByText('No tests impacted').first().isVisible();
      return !noTestsText; // Return true if there ARE impacted tests
    }, { timeout: 10000 }).toBeTruthy();
    hasImpactedTests = true;
  } catch (error) {
    hasImpactedTests = false;
  }

  if (hasImpactedTests) {
    console.log('Found impacted tests - testing full review functionality');
    
    // Click on the first impacted test
    await reviewDialog.locator('[data-testid="impacted-test-item"]').first().or(reviewDialog.locator('div').filter({ hasText: /test/ }).first()).click();

    // Assert elements in the Test Report section are visible
    // Assert video is visible
    await expect(reviewDialog.locator('video')).toBeVisible({ timeout: 10000 });

    // Assert stack trace is visible
    await expect(reviewDialog.getByText(/Error|Failed|Stack|Trace|Exception/)).toBeVisible();

    // Assert HTML link works (check that an HTML link is present and clickable)
    const htmlLink = reviewDialog.getByRole('link').filter({ hasText: /html|HTML|report/ }).first();
    await expect(htmlLink).toBeVisible();
    await expect(htmlLink).toHaveAttribute('href', /.+/);
  } else {
    console.log('No impacted tests found - verifying Review UI structure is correct');
    
    // Assert that the "No tests impacted" message is shown correctly
    await expect(impactedTestsTab.getByText('No tests impacted')).toBeVisible();
    
    // Assert that the Test Report section shows "No tests impacted" as well
    const testReportSection = reviewDialog.getByText('Test Report');
    await expect(testReportSection).toBeVisible();
    
    // Verify Review UI tabs are present and functional
    await expect(page.getByRole('tab', { name: 'Diff' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Impacted Tests/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Gist' })).toBeVisible();
  }
});

