import { test, expect } from "./fixtures";

test.describe("New Tab Navigation", () => {
  test("should click on 'See all tests' and navigate correctly", async ({ loggedInPage }) => {
    // Navigate to the specific test run page
    await loggedInPage.goto("https://dash.empirical.run/lorem-ipsum-tests/test-runs/23649?group_by=none&status=none");
    
    // Click on "See all tests" which opens in a new tab/popup
    const page1Promise = loggedInPage.waitForEvent('popup');
    await loggedInPage.getByRole('link', { name: 'See all tests' }).click();
    const newPage = await page1Promise;
    
    // Assert that a new page opened
    expect(newPage).toBeTruthy();
    
    // Wait for the new page to load and assert on its content
    await newPage.waitForLoadState('networkidle');
    
    // Assert that we're on the tests page (URL should contain /tests)
    await expect(newPage).toHaveURL(/\/tests/);
    
    // Assert that the page shows test-related content
    await expect(newPage.getByText('tests', { exact: false })).toBeVisible();
  });
});