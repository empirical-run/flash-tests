import { test, expect } from '@playwright/test';

test.describe('Review functionality', () => {
  test('create session, run database test, edit timeout, and review results', async ({ page, trackCurrentSession }) => {
    await page.goto('/');

    // Create a new session
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Verify we're in a session
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
    
    // Track the session for automatic cleanup
    trackCurrentSession(page);

    // Message 1: "run the database scenario test"
    await page.getByRole('textbox', { name: 'Send a message' }).fill('run the database scenario test');
    await page.getByRole('button', { name: 'Send', exact: true }).click();

    // Assert run test tool is running and was completed ("Used")
    await expect(page.getByText('Used runTest', { exact: false })).toBeVisible({ timeout: 60000 });

    // Message 2: "increase the timeout for the failing line to 30 secs"
    await page.getByRole('textbox', { name: 'Send a message' }).fill('increase the timeout for the failing line to 30 secs');
    await page.getByRole('button', { name: 'Send', exact: true }).click();

    // Assert text editor tool is called
    await expect(page.getByText('Used str_replace_based_edit_tool', { exact: false })).toBeVisible({ timeout: 60000 });

    // Open the review UI by clicking on review button
    await page.getByRole('button', { name: 'Review' }).click();

    // Assert impacted test is visible
    await expect(page.getByText('Impacted Tests')).toBeVisible();
    
    // Look for a test item in the impacted tests list
    const testItem = page.locator('[data-testid*="test-item"]').first();
    await expect(testItem).toBeVisible();

    // Click on the test item
    await testItem.click();

    // Assert stuff on the "report" tab - video is visible, stack trace is visible, html link works
    await expect(page.getByRole('tab', { name: 'Report' })).toBeVisible();
    
    // Ensure we're on the Report tab
    await page.getByRole('tab', { name: 'Report' }).click();

    // Assert video is visible
    await expect(page.getByText('Video', { exact: false })).toBeVisible();
    
    // Assert stack trace is visible
    await expect(page.getByText('Stack trace', { exact: false })).toBeVisible();
    
    // Assert HTML link works (check if HTML link is present and clickable)
    const htmlLink = page.getByRole('link', { name: 'HTML', exact: false });
    await expect(htmlLink).toBeVisible();
    
    // Verify the HTML link is functional (has href attribute)
    await expect(htmlLink).toHaveAttribute('href');
  });
});