import { test, expect } from "./fixtures";

test.describe("New Tab Navigation", () => {
  test("should navigate to test list when clicking 'See all tests'", async ({ loggedInPage }) => {
    // Navigate to the specific test run page
    await loggedInPage.goto("https://dash.empirical.run/lorem-ipsum-tests/test-runs/23649?group_by=none&status=none");
    
    // Click on "See all tests" which opens in a new tab
    const pagePromise = loggedInPage.waitForEvent('popup');
    await loggedInPage.getByRole('link', { name: 'See all tests' }).click();
    const newPage = await pagePromise;
    
    // Assert that the new page navigates to the tests list page
    await expect(newPage).toHaveURL(/\/lorem-ipsum-tests\/tests/);
    
    // Assert that the page shows the test list content
    await expect(newPage.getByRole("heading", { name: /tests/i })).toBeVisible();
    
    // Clean up by closing the new tab
    await newPage.close();
  });
});