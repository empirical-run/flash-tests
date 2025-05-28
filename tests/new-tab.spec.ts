import { test, expect } from "./fixtures";

test.describe("New tab functionality", () => {
  test("should click 'See all tests' on test run page", async ({ loggedInPage }) => {
    // Navigate to the specific test run page
    await loggedInPage.goto("https://dash.empirical.run/flash-tests/test-runs/23649?group_by=none&status=none");
    
    // Click on "See all tests" which opens a test report in a new tab
    const page1Promise = loggedInPage.waitForEvent('popup');
    await loggedInPage.getByRole('link', { name: 'See all tests' }).click();
    const page1 = await page1Promise;
    
    // Verify the new tab opened with the test report
    await expect(page1).toHaveURL(/https:\/\/reports\.empirical\.run\/flash\/\d+\/index\.html/);
    
    // Verify the report page is loaded by checking for common report elements
    await expect(page1.locator('body')).toBeVisible();
  });
});