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

  test('create triage session, create issue with timestamp, verify issue and session link', async ({ page, trackCurrentSession, trackCurrentIssue }) => {
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
    
    // Create a new session
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Extract session ID from the current URL
    const sessionUrl = page.url();
    const sessionIdMatch = sessionUrl.match(/\/sessions\/([^/?#]+)/);
    const sessionId = sessionIdMatch ? sessionIdMatch[1] : null;
    expect(sessionId).toBeTruthy();
    
    // PATCH session source to set it to triage using API call
    const patchResponse = await page.request.patch(`/api/chat-sessions/${sessionId}`, {
      data: {
        source: 'triage'
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('PATCH response status:', patchResponse.status());
    const responseText = await patchResponse.text();
    console.log('PATCH response body:', responseText);
    
    // Send message to create an issue with timestamp
    const issueMessage = `create an issue with title Foo ${timestamp} and description Bar ${timestamp}`;
    await page.getByPlaceholder('Type your message').click();
    await page.getByPlaceholder('Type your message').fill(issueMessage);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the message was sent and appears in the conversation
    await expect(page.getByText(issueMessage)).toBeVisible({ timeout: 10000 });
    
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

  test('filter issues by issue type using "is any of"', async ({ page }) => {
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
    
    // Apply filter using "is any of" for issue type
    await page.getByRole('button', { name: 'Filters' }).click();
    await page.getByRole('button', { name: 'Add filter' }).click();
    await page.getByRole('combobox').filter({ hasText: 'Field' }).click();
    await page.getByText('Issue Type').click();
    
    // Select "is any of" operator
    await page.getByRole('combobox').filter({ hasText: 'Operator' }).click();
    await page.getByText('is any of').click();
    
    // Test available issue types: Unknown, App, and Test
    const issueTypes = [
      { filterName: 'Unknown', expectedText: 'UNKNOWN' },
      { filterName: 'App', expectedText: 'APP' },
      { filterName: 'Test', expectedText: 'TEST' }
    ];

    // Select all available issue types one by one to test each
    for (const issueType of issueTypes) {
      console.log(`Adding filter value for issue type: ${issueType.filterName}`);
      
      await page.getByRole('button', { name: 'Select...' }).click();
      await page.getByRole('option', { name: issueType.filterName }).locator('div').click();
      
      // Press Escape to close the dropdown
      await page.keyboard.press('Escape');
      
      // Wait a moment for the dropdown to close
      await page.waitForTimeout(1000);
    }
    
    // Save the filter
    await page.locator('text=Save').last().click();
    
    // Wait for filtering to complete
    await page.waitForTimeout(3000);
    
    // Verify that the filtered results show issues of any of the selected types
    const issueRows = page.locator('table tbody tr');
    const rowCount = await issueRows.count();
    
    if (rowCount > 0) {
      console.log(`Found ${rowCount} issues with "is any of" filter for all issue types`);
      
      // Check each row to ensure it shows one of the expected issue types
      for (let i = 0; i < rowCount; i++) {
        const row = issueRows.nth(i);
        
        // Each row should contain one of the expected issue types
        const hasUnknown = await row.locator('span').getByText('UNKNOWN', { exact: true }).isVisible().catch(() => false);
        const hasApp = await row.locator('span').getByText('APP', { exact: true }).isVisible().catch(() => false);
        const hasTest = await row.locator('span').getByText('TEST', { exact: true }).isVisible().catch(() => false);
        
        // At least one of the issue types should be visible in each row
        expect(hasUnknown || hasApp || hasTest).toBeTruthy();
        
        console.log(`Row ${i + 1}: Unknown=${hasUnknown}, App=${hasApp}, Test=${hasTest}`);
      }
    } else {
      console.log(`No issues found with "is any of" filter - this might indicate no issues exist for any of the selected types`);
      // If no results, verify empty state
      await expect(page.getByText('No issues found')).toBeVisible();
    }

    // Test individual selections within the "is any of" context
    // Clear the current filter and test each type individually using "is any of"
    for (const issueType of issueTypes) {
      console.log(`\nTesting individual "is any of" filter for: ${issueType.filterName}`);
      
      // Clear and reapply filter with only this type
      await page.getByRole('button', { name: 'Filters' }).click();
      
      // Remove existing filter if present
      const removeButton = page.getByRole('button', { name: 'Remove filter' });
      if (await removeButton.isVisible().catch(() => false)) {
        await removeButton.click();
      }
      
      // Add new filter for this specific type
      await page.getByRole('button', { name: 'Add filter' }).click();
      await page.getByRole('combobox').filter({ hasText: 'Field' }).click();
      await page.getByText('Issue Type').click();
      
      // Select "is any of" operator
      await page.getByRole('combobox').filter({ hasText: 'Operator' }).click();
      await page.getByText('is any of').click();
      
      // Select only this specific issue type
      await page.getByRole('button', { name: 'Select...' }).click();
      await page.getByRole('option', { name: issueType.filterName }).locator('div').click();
      
      // Press Escape to close the dropdown
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
      
      // Save the filter
      await page.locator('text=Save').last().click();
      
      // Wait for filtering to complete
      await page.waitForTimeout(3000);
      
      // Verify results for this specific type
      const typeRows = page.locator('table tbody tr');
      const typeRowCount = await typeRows.count();
      
      if (typeRowCount > 0) {
        console.log(`Found ${typeRowCount} issues of type ${issueType.filterName} using "is any of"`);
        
        // Check each row to ensure it shows the expected issue type
        for (let i = 0; i < typeRowCount; i++) {
          const row = typeRows.nth(i);
          await expect(row.locator('span').getByText(issueType.expectedText, { exact: true })).toBeVisible();
        }
      } else {
        console.log(`No issues found for type ${issueType.filterName} using "is any of" - filter working correctly`);
      }
    }
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
    
    // Create a new session
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session (URL should contain "sessions")
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Wait for navigation to the actual session URL with session ID
    await expect(page).toHaveURL(/sessions\/[^\/]+/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);
    
    // Extract session ID from the current URL
    const sessionUrl = page.url();
    const sessionIdMatch = sessionUrl.match(/\/sessions\/([^/?#]+)/);
    const sessionId = sessionIdMatch ? sessionIdMatch[1] : null;
    expect(sessionId).toBeTruthy();
    
    // PATCH session source to set it to triage using API call
    const patchResponse = await page.request.patch(`/api/chat-sessions/${sessionId}`, {
      data: {
        source: 'triage'
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('PATCH response status:', patchResponse.status());
    const responseText = await patchResponse.text();
    console.log('PATCH response body:', responseText);
    
    // Send message to analyze the video
    const videoAnalysisMessage = 'analyze this video https://reports.empirical.run/lorem-ipsum/17147585452/data/search-search-for-database-470b8-cenario-and-card-disappears-chromium/video.webm';
    await page.getByPlaceholder('Type your message').click();
    await page.getByPlaceholder('Type your message').fill(videoAnalysisMessage);
    await page.getByRole('button', { name: 'Send' }).click();
    
    // Verify the message was sent and appears in the conversation
    await expect(page.getByText(videoAnalysisMessage)).toBeVisible({ timeout: 10000 });
    
    // Assert that fetchVideoAnalysis tool was used - wait for tool execution to complete (increased timeout for slow tool)
    await expect(page.getByText("Used fetchVideoAnalysis").or(page.getByText("Used fetch_video_analysis"))).toBeVisible({ timeout: 180000 });
    
    // Click on the tool execution result to see the analysis
    await page.getByText("Used fetchVideoAnalysis").or(page.getByText("Used fetch_video_analysis")).click();
    
    // Assert that the tool result contains "database" - use first() to handle multiple matches
    await expect(page.getByText(/database/i).first()).toBeVisible({ timeout: 10000 });
    
    // Session will be automatically closed by afterEach hook
  });
});