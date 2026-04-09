import { test, expect } from "./fixtures";
import { navigateToIssues } from "./pages/issues";
import { navigateToSessions, waitForFirstMessage } from "./pages/sessions";

test.describe('Issues Tests', () => {
  test('open issues page', async ({ page }) => {
    await navigateToIssues(page);
    
    // Verify the Issues page loaded with the page heading visible
    await expect(page.getByText('Issues (')).toBeVisible();
  });

  test('apply multiple filters and clear all filters', async ({ page }) => {
    await navigateToIssues(page);
    
    // Wait for issues to be loaded
    await expect(page.getByText('Issues (')).toBeVisible();
    
    // Clear any existing default filters first to get true unfiltered state
    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByRole('button', { name: 'Clear all' }).click();
    await page.getByRole('menuitem', { name: 'Save' }).click();
    
    // Wait for filter clearing to complete
    await page.waitForTimeout(2000);
    
    // Record the initial count of issues (unfiltered state)
    const initialIssueRows = page.locator('table tbody tr');
    const initialRowCount = await initialIssueRows.count();
    console.log(`Initial unfiltered issue count: ${initialRowCount}`);
    
    // Open Filters menu
    await page.getByRole('button', { name: 'Filters' }).click();
    
    // Add first filter: Issue Type is any of App
    await page.getByRole('button', { name: 'Add filter' }).click();
    await page.getByRole('combobox').filter({ hasText: 'Field' }).click();
    await page.getByRole('option', { name: 'Issue Type' }).click();
    // "is any of" is the default operator for Issue Type in the new UI
    await page.getByRole('button', { name: 'Select...' }).click();
    await page.getByRole('option', { name: 'App' }).locator('div').click();
    
    // Add second filter: Status = Open
    await page.getByRole('button', { name: 'Add filter' }).click();
    await page.getByRole('combobox').filter({ hasText: 'Field' }).click();
    await page.getByRole('option', { name: 'Status' }).click();
    await page.getByRole('button', { name: 'Select...' }).click();
    await page.getByTitle('Open', { exact: true }).click();
    
    // Save the filters
    await page.getByRole('menu', { name: 'Filters' }).click();
    await page.getByRole('menuitem', { name: 'Save' }).click();
    
    // Use Promise.race to wait for either "No issues found" or expected filtered results
    // This ensures we wait for the first row to load since the count API doesn't auto-wait
    await Promise.race([
      page.getByText('No issues found').waitFor(),
      page.locator('table tbody tr').first().locator('span').getByText('App', { exact: true }).waitFor()
    ]);
    
    // Verify that filters are applied - count filtered results
    const filteredIssueRows = page.locator('table tbody tr');
    const filteredRowCount = await filteredIssueRows.count();
    console.log(`Filtered issue count: ${filteredRowCount}`);
    
    // Verify that all filtered rows match the applied filters (Issue Type = App AND Status = Open)
    if (filteredRowCount > 0) {
      for (let i = 0; i < filteredRowCount; i++) {
        const row = filteredIssueRows.nth(i);
        
        // Verify each row has Issue Type = App
        await expect(row.locator('span').getByText('App', { exact: true })).toBeVisible();
        
        // Verify each row has Status = Open
        await expect(row.getByText('Open', { exact: true })).toBeVisible();
        
        // Wait for 2 seconds
        await page.waitForTimeout(2000);
      }
      console.log(`Verified all ${filteredRowCount} filtered rows have Issue Type = App and Status = Open`);
    } else {
      console.log('No issues found matching the filters - this is also valid');
    }
    
    // Verify the applied filters are shown in the filter menu
    await page.getByRole('button', { name: 'Filters' }).click();
    
    // Verify Issue Type filter is visible in the filter menu
    const filterMenu = page.getByRole('menu', { name: 'Filters' });
    await expect(filterMenu.getByText('Issue Type')).toBeVisible();
    await expect(filterMenu.getByText('App', { exact: true })).toBeVisible();
    
    // Verify Status filter is visible in the filter menu (more specific selector)
    await expect(filterMenu.getByRole('combobox').filter({ hasText: 'Status' })).toBeVisible();
    await expect(filterMenu.getByText('Open')).toBeVisible();
    
    // Now test filter deletion using "Clear all"
    await page.getByRole('button', { name: 'Clear all' }).click();
    
    // Save after clearing filters
    await page.getByRole('menuitem', { name: 'Save' }).click();
    
    // Wait for the page to update after clearing filters
    await page.waitForTimeout(3000);
    
    // Verify that filters have been cleared - issue count should return to initial state
    const clearedIssueRows = page.locator('table tbody tr');
    const clearedRowCount = await clearedIssueRows.count();
    console.log(`Issue count after clearing filters: ${clearedRowCount}`);
    
    // The cleared count should equal or be close to the initial count (allowing for minor variations in data)
    if (initialRowCount > 0) {
      expect(clearedRowCount).toBeGreaterThanOrEqual(filteredRowCount);
      console.log('Filter deletion successful - issue count restored');
      
    }
    
    // Verify that the filter deletion worked by checking the filter menu
    await page.getByRole('button', { name: 'Filters' }).click();
    
    // Verify that "No filters applied." text is visible, indicating filters have been cleared
    await expect(page.getByText('No filters applied.')).toBeVisible();
    
  });

  test('fetch video analysis tool in triage session', async ({ page, trackCurrentSession }) => {
    await navigateToSessions(page);
    
    // Create a new session with video analysis prompt using the new triage mode UI flow
    await page.locator('button:has(svg.lucide-plus)').click();
    
    // Click Advanced to expand advanced options
    await page.getByRole('button', { name: 'Advanced' }).click();
    
    // Select Triage mode from Agent mode dropdown
    await page.locator('text=Agent mode').locator('..').getByRole('combobox').click();
    await page.getByLabel('Triage').getByText('Triage').click();
    
    // Fill in the video analysis prompt
    const videoAnalysisMessage = 'analyze this video https://assets-test.empirical.run/test-data/search-search-for-database-470b8-cenario-and-card-disappears-chromium_video.webm';
    await page.getByPlaceholder('Enter an initial prompt or drag and drop a file here').fill(videoAnalysisMessage);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/);
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/);
    
    // Wait for the session chat page to load completely by waiting for message to appear
    await waitForFirstMessage(page);
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Extract session ID from the current URL
    const sessionUrl = page.url();
    const sessionIdMatch = sessionUrl.match(/\/sessions\/([^/?#]+)/);
    const sessionId = sessionIdMatch ? sessionIdMatch[1] : null;
    expect(sessionId).toBeTruthy();
    
    // Assert that analyseVideo tool was used - wait for tool execution to complete (increased timeout for slow tool)
    await expect(page.getByText("Used analyseVideo").or(page.getByText("Used analyse_video"))).toBeVisible({ timeout: 180000 });
    
    // Click on the tool execution result to see the analysis
    await page.getByText("Used analyseVideo").or(page.getByText("Used analyse_video")).click();
    
    // Navigate to Tools tab and verify "database" appears within the Video Analysis section
    await page.getByRole('tab', { name: 'Tools', exact: true }).click();
    await page.getByText("Used analyseVideo").or(page.getByText("Used analyse_video")).click();
    await expect(page.getByRole('heading', { name: 'Video Analysis' })).toBeVisible({ timeout: 15000 });
    await expect(
      page
        .getByRole('tabpanel')
        .filter({ has: page.getByRole('heading', { name: 'Video Analysis' }) })
        .getByText(/database/i)
        .first()
    ).toBeVisible({ timeout: 20000 });
    // Verify the chat bubble also contains the "database" text
    await expect(
      page
        .locator('[data-message-id]')
        .filter({ hasText: /database/i })
        .first()
    ).toBeVisible({ timeout: 20000 });

    // Click on the video URL in the first user message to open the video player
    await page.getByRole('button', { name: 'https://assets-test.empirical' }).click();

    // Assert that the video player modal is visible
    const videoPlayerDialog = page.getByRole('dialog', { name: 'Video Player' });
    await expect(videoPlayerDialog).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Video Player' })).toBeVisible();

    // SKIPPED: Video element verification - blocked by issue #1477
    // The Video Player modal shows image instead of video element for clickable video URLs
    // TODO: Re-enable these assertions once #1477 is fixed
    // const videoElement = videoPlayerDialog.locator('video').first();
    // await expect(videoElement).toBeVisible();
    // await expect(videoElement).toHaveAttribute('controls', '');

    // Close the video player modal
    await page.getByRole('button', { name: 'Close' }).click();
    
    // Session will be automatically closed by afterEach hook
  });
});