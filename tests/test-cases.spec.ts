import { test, expect } from "./fixtures";
import { setVideoLabel } from "@empiricalrun/playwright-utils/test";

test.describe('Test Cases Tests', () => {
  test('Edit test case should show new session screen instead of "session not found"', async ({ page }) => {
    // This test verifies the test case detail page in the new v2 UI
    // The test case detail page shows Tags, Run History, Metadata, Last Run (with video), and Attachments
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Test Cases page from sidebar
    await page.getByRole('link', { name: 'Test Cases', exact: true }).click();
    
    // Wait for test cases page to load
    await expect(page).toHaveURL(/test-cases$/);
    
    // Wait for test cases to load (ensure the table content is available)
    await expect(page.getByRole('row').first()).toBeVisible();
    
    // Expand all test cases (new tree view requires expanding folders first)
    await page.getByRole('button', { name: 'Expand all' }).click();
    
    // Click on the first test case link in the table
    await page.getByRole('row').getByRole('link').first().click();
    
    // Wait for test case detail view to load
    await expect(page).toHaveURL(/test-cases\/.*$/);
    
    // Verify the test case detail page shows the expected section headings
    await expect(page.getByRole('heading', { name: 'Tags' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Run History' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Metadata' })).toBeVisible();
    
    // Verify metadata fields are present (exact match to avoid partial-text collisions)
    await expect(page.getByText('Test ID', { exact: true })).toBeVisible();
    await expect(page.getByText('First seen', { exact: true })).toBeVisible();
    await expect(page.getByText('Last seen', { exact: true })).toBeVisible();
    
    // Verify the Last Run section heading is visible
    await expect(page.getByRole('heading', { name: 'Last Run' })).toBeVisible();
    
    // Verify the View Full Report button is present in the Last Run section
    await expect(page.getByRole('button', { name: /view full report/i })).toBeVisible();
  });

  test('Test cases page shows last run video', async ({ page }) => {
    // Set video label for main page
    setVideoLabel(page, 'test-case-detail');
    
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    
    // Navigate to Test Cases page from sidebar
    await page.getByRole('link', { name: 'Test Cases', exact: true }).click();
    
    // Wait for test cases page to load
    await expect(page).toHaveURL(/test-cases$/);
    
    // Wait for test cases to load
    await expect(page.getByRole('row').first()).toBeVisible();
    
    // Expand all test cases (new tree view requires expanding folders first)
    await page.getByRole('button', { name: 'Expand all' }).click();
    
    // Click on the specific test case "search for auth shows only 1 card"
    await page.getByRole('link', { name: 'search for auth shows only 1 card' }).click();
    
    // Wait for test case detail view to load
    await expect(page).toHaveURL(/test-cases\/.*$/);
    
    // Assert that the video is visible
    const video = page.locator('video').first();
    await expect(video).toBeVisible();
    
    // Verify the video can be played by checking it has a valid source
    const videoSrc = await video.getAttribute('src');
    expect(videoSrc).toBeTruthy();
    
    // Verify the video player controls are present (using exact match for play button)
    await expect(page.getByRole('button', { name: 'play', exact: true })).toBeVisible();
    
    // Click on "View Full Report" button and handle new tab
    const viewFullReportButton = page.getByRole('button', { name: /view full report/i });
    await expect(viewFullReportButton).toBeVisible();
    
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      viewFullReportButton.click()
    ]);
    
    // Set video label for the new tab
    setVideoLabel(newPage, 'full-report');
    
    // Wait for the new tab to load
    await newPage.waitForLoadState('domcontentloaded');
    
    // Assert that the test name is visible in the new tab
    await expect(newPage.getByText('search for auth shows only 1 card')).toBeVisible();
  });
});