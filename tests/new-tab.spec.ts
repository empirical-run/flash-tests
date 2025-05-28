import { test, expect } from "./fixtures";

test.describe("New tab functionality", () => {
  test("should click 'See all tests' on test run page", async ({ loggedInPage }) => {
    // Navigate to the specific test run page
    await loggedInPage.goto("https://dash.empirical.run/flash-tests/test-runs/23649?group_by=none&status=none");
    
    // Click on "See all tests" which opens in a new tab
    const page1Promise = loggedInPage.waitForEvent('popup');
    await loggedInPage.getByRole('link', { name: 'See all tests' }).click();
    const page1 = await page1Promise;
    
    // Verify the new tab opened and contains expected content
    await expect(page1).toHaveURL(/.*\/test-cases/);
    await expect(page1.getByText('Test Cases')).toBeVisible();
  });
});