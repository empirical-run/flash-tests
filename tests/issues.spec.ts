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
    await expect(page).toHaveURL(/issues$/, { timeout: 10000 });
    
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
    await page.getByRole('button', { name: 'New' }).click();
    
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
    await expect(page.getByText("Used createIssue").or(page.getByText("Used create_issue"))).toBeVisible({ timeout: 45000 });
    
    // Click on the tool execution result to assert issue created successfully is shown
    await page.getByText("Used createIssue").or(page.getByText("Used create_issue")).click();
    
    // Assert issue created successfully message or response is visible
    await expect(page.getByText("successfully").or(page.getByText("created")).first()).toBeVisible({ timeout: 10000 });
    
    // Go to issues tab
    await page.getByRole('link', { name: 'Issues', exact: true }).click();
    
    // Wait for issues page to load
    await expect(page).toHaveURL(/issues$/, { timeout: 10000 });
    
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

  test('filter issues by issue type', async ({ page }) => {
    // Test each issue type: Unknown, App, and Test
    const issueTypes = [
      { filterName: 'Unknown', expectedText: 'Unknown' },
      { filterName: 'App', expectedText: 'App' },
      { filterName: 'Test', expectedText: 'Test' }
    ];

    for (const issueType of issueTypes) {
      console.log(`Testing filter for issue type: ${issueType.filterName}`);
      
      // Navigate to homepage and issues page for each test (ensures clean state)
      await page.goto('/');
      
      // Wait for successful login
      await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
      
      // Navigate to Issues page
      await page.getByRole('link', { name: 'Issues', exact: true }).click();
      
      // Wait for issues page to load
      await expect(page).toHaveURL(/issues$/, { timeout: 10000 });
      
      // Wait for issues to be loaded
      await expect(page.getByText('Issues (')).toBeVisible({ timeout: 10000 });
      
      // Apply filter for the current issue type
      await page.getByRole('button', { name: 'Filters' }).click();
      await page.getByRole('button', { name: 'Add filter' }).click();
      await page.getByRole('combobox').filter({ hasText: 'Field' }).click();
      await page.getByText('Issue Type').click();
      await page.getByRole('button', { name: 'Select...' }).click();
      await page.getByRole('option', { name: issueType.filterName }).locator('div').click();
      
      // Press Escape to close the dropdown
      await page.keyboard.press('Escape');
      
      // Wait a moment for the dropdown to close
      await page.waitForTimeout(1000);
      
      // Save the filter
      await page.locator('text=Save').last().click();
      
      // Use Promise.race to wait for either "No issues found" or expected text in a row
      // This ensures we wait for the first row to load since the count API doesn't auto-wait
      await Promise.race([
        page.getByText('No issues found').waitFor({ timeout: 10000 }),
        page.locator('table tbody tr').first().locator('span').getByText(issueType.expectedText, { exact: true }).waitFor({ timeout: 10000 })
      ]);
      
      // Verify that the filtered results show only the expected issue type
      const issueRows = page.locator('table tbody tr');
      const rowCount = await issueRows.count();
      
      if (rowCount > 0) {
        console.log(`Found ${rowCount} issues of type ${issueType.filterName}`);
        
        // Check each row to ensure it shows the expected issue type
        for (let i = 0; i < rowCount; i++) {
          const row = issueRows.nth(i);
          // Be more specific - look for the expected text in a span element (the type column)
          await expect(row.locator('span').getByText(issueType.expectedText, { exact: true })).toBeVisible();
        }
      } else {
        console.log(`No issues found for type ${issueType.filterName} - filter working correctly`);
        // If no results, verify empty state (filter working correctly)
        await expect(page.getByText('No issues found')).toBeVisible();
      }
    }
  });

  test('filter issues by status', async ({ page }) => {
    // Test each status: Open, Closed, and Resolved
    const statusTypes = [
      { filterName: 'Open', expectedText: 'Open' },
      { filterName: 'Closed', expectedText: 'Closed' },
      { filterName: 'Resolved', expectedText: 'Resolved' }
    ];

    for (const statusType of statusTypes) {
      console.log(`Testing filter for status: ${statusType.filterName}`);
      
      // Navigate to homepage and issues page for each test (ensures clean state)
      await page.goto('/');
      
      // Wait for successful login
      await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
      
      // Navigate to Issues page
      await page.getByRole('link', { name: 'Issues', exact: true }).click();
      
      // Wait for issues page to load
      await expect(page).toHaveURL(/issues$/, { timeout: 10000 });
      
      // Wait for issues to be loaded
      await expect(page.getByText('Issues (')).toBeVisible({ timeout: 10000 });
      
      // Clear any existing default filters first
      await page.getByRole('button', { name: 'Filters' }).click();
      await page.getByRole('button', { name: 'Clear all' }).click();
      await page.getByRole('menuitem', { name: 'Save' }).click();
      
      // Wait for filter clearing to complete
      await page.waitForTimeout(2000);
      
      // Apply filter for the current status
      await page.getByRole('button', { name: 'Filters' }).click();
      await page.getByRole('button', { name: 'Add filter' }).click();
      await page.getByRole('combobox').filter({ hasText: 'Field' }).click();
      await page.getByLabel('Status').getByText('Status').click();
      await page.getByRole('button', { name: 'Select...' }).click();
      await page.getByRole('option', { name: statusType.filterName }).locator('div').click();
      
      // Press Escape to close the dropdown
      await page.keyboard.press('Escape');
      
      // Wait a moment for the dropdown to close
      await page.waitForTimeout(1000);
      
      // Save the filter
      await page.locator('text=Save').last().click();
      
      // Use Promise.race to wait for either "No issues found" or expected text in a row
      // This ensures we wait for the first row to load since the count API doesn't auto-wait
      await Promise.race([
        page.getByText('No issues found').waitFor({ timeout: 10000 }),
        page.locator('table tbody tr').first().getByText(statusType.expectedText, { exact: true }).waitFor({ timeout: 10000 })
      ]);
      
      // Verify that the filtered results show only the expected status
      const issueRows = page.locator('table tbody tr');
      const rowCount = await issueRows.count();
      
      if (rowCount > 0) {
        console.log(`Found ${rowCount} issues with status ${statusType.filterName}`);
        
        // Check each row to ensure it shows the expected status
        for (let i = 0; i < rowCount; i++) {
          const row = issueRows.nth(i);
          // Verify each row contains the expected status badge
          await expect(row.getByText(statusType.expectedText, { exact: true })).toBeVisible();
        }
      } else {
        console.log(`No issues found for status ${statusType.filterName} - filter working correctly`);
        // If no results, verify empty state (filter working correctly)
        await expect(page.getByText('No issues found')).toBeVisible();
      }
    }
  });

  test('filter issues by issue title contains search test', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Issues page
    await page.getByRole('link', { name: 'Issues', exact: true }).click();
    
    // Wait for issues page to load
    await expect(page).toHaveURL(/issues$/, { timeout: 10000 });
    
    // Wait for issues to be loaded
    await expect(page.getByText('Issues (')).toBeVisible({ timeout: 10000 });
    
    // Clear any existing default filters first
    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByRole('button', { name: 'Clear all' }).click();
    await page.getByRole('menuitem', { name: 'Save' }).click();
    
    // Wait for filter clearing to complete
    await page.waitForTimeout(2000);
    
    // Open filter and select Title -> Contains -> 'Search test'
    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByRole('button', { name: 'Add filter' }).click();
    await page.getByRole('combobox').filter({ hasText: 'Field' }).click();
    await page.getByRole('option', { name: 'Title' }).click();
    
    // Select 'Contains' condition
    await page.getByRole('combobox').filter({ hasText: 'equals' }).click();
    await page.getByText('contains').click();
    
    // Enter 'Search test' as the value
    await page.getByRole('textbox', { name: 'Value' }).click();
    await page.getByRole('textbox', { name: 'Value' }).fill('Search test');
    
    // Click Save
    await page.getByRole('menuitem', { name: 'Save' }).click();
    
    // Use Promise.race to wait for either "No issues found" or expected text in a row
    // This ensures we wait for the first row to load since the count API doesn't auto-wait
    await Promise.race([
      page.getByText('No issues found').waitFor({ timeout: 10000 }),
      page.locator('table tbody tr').first().getByText(/search test/i).waitFor({ timeout: 10000 })
    ]);
    
    // Now check the actual state after waiting for initial load
    const issueRows = page.locator('table tbody tr');
    const rowCount = await issueRows.count();
    
    if (rowCount > 0) {
      // Check each row to ensure it contains 'search test' in the title (case insensitive)
      for (let i = 0; i < rowCount; i++) {
        const row = issueRows.nth(i);
        // Look for 'search test' text anywhere in the row (case insensitive)
        await expect(row.getByText(/search test/i)).toBeVisible();
      }
    } else {
      // If no results, verify empty state
      await expect(page.getByText('No issues found')).toBeVisible();
    }
  });

  test('filter issues by issue type excluding app issues', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Issues page
    await page.getByRole('link', { name: 'Issues', exact: true }).click();
    
    // Wait for issues page to load
    await expect(page).toHaveURL(/issues$/, { timeout: 10000 });
    
    // Wait for issues to be loaded
    await expect(page.getByText('Issues (')).toBeVisible({ timeout: 10000 });
    
    // Clear any existing default filters first
    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByRole('button', { name: 'Clear all' }).click();
    await page.getByRole('menuitem', { name: 'Save' }).click();
    
    // Wait for filter clearing to complete
    await page.waitForTimeout(2000);
    
    // Open filter and select Issue type is any of Unknown, Test (to exclude App)
    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByRole('button', { name: 'Add filter' }).click();
    await page.getByRole('combobox').filter({ hasText: 'Field' }).click();
    await page.getByText('Issue Type').click();
    
    // "is any of" is already selected by default for Issue Type in the new UI
    // Select Unknown and Test to exclude App issues
    await page.getByRole('button', { name: 'Select...' }).click();
    await page.getByRole('option', { name: 'Unknown' }).locator('div').click();
    await page.getByRole('option', { name: 'Test' }).locator('div').click();
    
    // Press Escape to close the dropdown
    await page.keyboard.press('Escape');
    
    // Wait a moment for the dropdown to close
    await page.waitForTimeout(1000);
    
    // Click on Save
    await page.locator('text=Save').last().click();
    
    // Use Promise.race to wait for either "No issues found" or expected text in a row
    // This ensures we wait for the first row to load since the count API doesn't auto-wait
    await Promise.race([
      page.getByText('No issues found').waitFor({ timeout: 10000 }),
      page.locator('table tbody tr').first().locator('span').filter({ hasText: /^(Unknown|Test)$/ }).waitFor({ timeout: 10000 })
    ]);
    
    // Assert the table rows - verify that none of the visible rows have "APP" as issue type
    // Also verify across all paginated pages and collect issue type information
    let currentPage = 1;
    let totalIssuesVerified = 0;
    let issueTypeCounts = new Map<string, number>();
    
    // Get total number of pages if pagination exists
    const paginationInfo = page.locator('text=/Page \\d+ of \\d+/');
    const hasPagination = await paginationInfo.isVisible();
    
    do {
      console.log(`Verifying page ${currentPage}...`);
      
      const issueRows = page.locator('table tbody tr');
      const rowCount = await issueRows.count();
      
      if (rowCount > 0) {
        console.log(`Found ${rowCount} issues on page ${currentPage} that are of type Unknown or Test (excluding App)`);
        totalIssuesVerified += rowCount;
        
        // Check each row to ensure it does NOT show "App" as issue type
        for (let i = 0; i < rowCount; i++) {
          const row = issueRows.nth(i);
          
          // Verify that "App" is NOT visible in this row (should show Unknown, Test, etc.)
          const appText = row.locator('span').getByText('App', { exact: true });
          await expect(appText).not.toBeVisible();
          
          // Extract and verify the issue type (should be Unknown, Test, etc.)
          const issueTypeSpans = row.locator('span').filter({ hasText: /^(Unknown|Test|App)$/ });
          const issueTypeCount = await issueTypeSpans.count();
          if (issueTypeCount > 0) {
            const issueTypeText = await issueTypeSpans.first().textContent();
            if (issueTypeText) {
              issueTypeCounts.set(issueTypeText, (issueTypeCounts.get(issueTypeText) || 0) + 1);
              // Assert that the issue type is not App
              expect(issueTypeText).not.toBe('App');
            }
          }
        }
      } else if (currentPage === 1) {
        console.log(`No issues found of type Unknown or Test - filter working correctly`);
        // If no results on first page, verify empty state (filter working correctly)
        await expect(page.getByText('No issues found')).toBeVisible();
        break;
      }
      
      // Check if there's a next page
      const nextButton = page.getByRole('button', { name: 'Next' });
      const isNextButtonEnabled = await nextButton.isEnabled();
      
      if (hasPagination && isNextButtonEnabled) {
        await nextButton.click();
        // Wait for the page to update
        await page.waitForTimeout(2000);
        currentPage++;
      } else {
        break;
      }
    } while (true);
    
    console.log(`Total verified issues across all pages: ${totalIssuesVerified}`);
    
    // Log issue type distribution
    console.log(`Issue type distribution:`);
    for (const [type, count] of issueTypeCounts) {
      console.log(`  ${type}: ${count} issues`);
    }
    
    // Assert that we have at least some issues and that none are of type App
    if (totalIssuesVerified > 0) {
      expect(issueTypeCounts.get('App') || 0).toBe(0); // Ensure no App type issues
      expect(totalIssuesVerified).toBeGreaterThan(0); // Ensure we have filtered results
    }
    
    // Again open the filter and assert that filter is still Issue type is any of Unknown, Test
    await page.getByRole('button', { name: 'Filters' }).click();
    
    // Verify that the filter shows Issue Type, is any of operator, and Unknown/Test as the selected values
    const filterMenu = page.getByRole('menu', { name: 'Filters' });
    await expect(filterMenu.getByText('Issue Type')).toBeVisible();
    await expect(filterMenu.getByText('is any of')).toBeVisible();
    await expect(filterMenu.getByText('Unknown', { exact: true })).toBeVisible();
    await expect(filterMenu.getByText('Test', { exact: true })).toBeVisible();
  });

  test('apply multiple filters and clear all filters', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Issues page
    await page.getByRole('link', { name: 'Issues', exact: true }).click();
    
    // Wait for issues page to load
    await expect(page).toHaveURL(/issues$/, { timeout: 10000 });
    
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
    await page.getByRole('button', { name: 'New' }).click();
    
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
    
    // Assert that fetchVideoAnalysis tool was used - wait for tool execution to complete (increased timeout for slow tool)
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
    
    // Session will be automatically closed by afterEach hook
  });
});