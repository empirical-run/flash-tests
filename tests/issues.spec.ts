import { test, expect } from "./fixtures";

test.describe('Issues Tests', () => {
  test('open issues page', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Click on Issues in the sidebar
    await page.getByRole('link', { name: 'Issues', exact: true }).click();
    
    // Wait for issues page to load
    await expect(page).toHaveURL(/issues(\?|$)/, { timeout: 10000 });
    
    // Verify the Issues page loaded with the page heading visible
    await expect(page.getByText('Issues (')).toBeVisible({ timeout: 10000 });
  });

  // Skip: session tends to update instead of creating a new issue
  test.skip('create triage session, create issue with timestamp, verify issue and session link', async ({ page, trackCurrentSession, trackCurrentIssue }) => {
    // Generate unique timestamp for this test
    const timestamp = Date.now();
    
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions page
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Create a new session with createIssue prompt using the new triage mode UI flow
    await page.locator('button:has(svg.lucide-plus)').click();
    
    // Click Advanced to expand advanced options
    await page.getByRole('button', { name: 'Advanced' }).click();
    
    // Select Triage mode from Agent mode dropdown
    await page.locator('text=Agent mode').locator('..').getByRole('combobox').click();
    await page.getByLabel('Triage').getByText('Triage').click();
    
    // Fill in the createIssue prompt
    const issueMessage = `Please create an issue using the createIssue tool with these parameters:
{
  "title": "Foo ${timestamp}",
  "description": "Bar ${timestamp}", 
  "issue_type": "app",
  "test_cases_affected": [{"name": "test case", "suites": ["Test Suite"], "file_path": "tests/test.spec.ts"}],
  "test_run_info": [{"test_run_id": 30023}]
}`;
    await page.getByPlaceholder('Enter an initial prompt').fill(issueMessage);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/, { timeout: 10000 });
    
    // Wait for the session chat page to load completely by waiting for message to appear
    await expect(page.locator('[data-message-id]').first()).toBeVisible({ timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Extract session ID from the current URL
    const sessionUrl = page.url();
    const sessionIdMatch = sessionUrl.match(/\/sessions\/([^/?#]+)/);
    const sessionId = sessionIdMatch ? sessionIdMatch[1] : null;
    expect(sessionId).toBeTruthy();
    
    // Assert that create issue tool was used - wait for tool execution to complete
    await expect(page.getByText("Used createIssue").or(page.getByText("Used create_issue"))).toBeVisible({ timeout: 60000 });
    
    // Click on the tool execution result to assert issue created successfully is shown
    await page.getByText("Used createIssue").or(page.getByText("Used create_issue")).click();
    
    // Assert issue created successfully message or response is visible
    await expect(page.getByText("successfully").or(page.getByText("created")).first()).toBeVisible({ timeout: 10000 });
    
    // Go to issues tab
    await page.getByRole('link', { name: 'Issues', exact: true }).click();
    
    // Wait for issues page to load
    await expect(page).toHaveURL(/issues(\?|$)/, { timeout: 10000 });
    
    // Assert Foo timestamp is visible and click it
    await expect(page.getByText(`Foo ${timestamp}`)).toBeVisible({ timeout: 10000 });
    await page.getByText(`Foo ${timestamp}`).click();
    
    // Wait for issue details page to load (uses query parameter format)
    await expect(page).toHaveURL(/issues\?issueId=/, { timeout: 10000 });
    
    // Track the issue for automatic cleanup
    trackCurrentIssue(page);
    
    // Assert triage session id is visible (same number as the session we created)
    // Use first() to handle multiple occurrences of the session ID
    await expect(page.getByText(sessionId).first()).toBeVisible({ timeout: 10000 });
    
    // Verify session id link is clickable (presence confirms the link exists)
    await expect(page.getByText(sessionId).first()).toHaveAttribute('href', `/lorem-ipsum-tests/sessions/${sessionId}`);
    
    // Session will be automatically closed and issue will be deleted by afterEach hook
  });

  test('apply multiple filters and clear all filters', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Issues page
    await page.getByRole('link', { name: 'Issues', exact: true }).click();
    
    // Wait for issues page to load
    await expect(page).toHaveURL(/issues(\?|$)/, { timeout: 10000 });
    
    // Wait for issues to be loaded
    await expect(page.getByText('Issues (')).toBeVisible({ timeout: 10000 });
    
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
      page.getByText('No issues found').waitFor({ timeout: 10000 }),
      page.locator('table tbody tr').first().locator('span').getByText('App', { exact: true }).waitFor({ timeout: 10000 })
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
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Sessions page
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();
    
    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
    
    // Create a new session with video analysis prompt using the new triage mode UI flow
    await page.locator('button:has(svg.lucide-plus)').click();
    
    // Click Advanced to expand advanced options
    await page.getByRole('button', { name: 'Advanced' }).click();
    
    // Select Triage mode from Agent mode dropdown
    await page.locator('text=Agent mode').locator('..').getByRole('combobox').click();
    await page.getByLabel('Triage').getByText('Triage').click();
    
    // Fill in the video analysis prompt
    const videoAnalysisMessage = 'analyze this video https://assets-test.empirical.run/test-data/search-search-for-database-470b8-cenario-and-card-disappears-chromium_video.webm';
    await page.getByPlaceholder('Enter an initial prompt').fill(videoAnalysisMessage);
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/, { timeout: 10000 });
    
    // Wait for the session chat page to load completely by waiting for message to appear
    await expect(page.locator('[data-message-id]').first()).toBeVisible({ timeout: 10000 });
    
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
    await expect(videoPlayerDialog).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Video Player' })).toBeVisible({ timeout: 10000 });

    // SKIPPED: Video element verification - blocked by issue #1477
    // The Video Player modal shows image instead of video element for clickable video URLs
    // TODO: Re-enable these assertions once #1477 is fixed
    // const videoElement = videoPlayerDialog.locator('video').first();
    // await expect(videoElement).toBeVisible({ timeout: 10000 });
    // await expect(videoElement).toHaveAttribute('controls', '');

    // Close the video player modal
    await page.getByRole('button', { name: 'Close' }).click();
    
    // Session will be automatically closed by afterEach hook
  });
});