import { test, expect } from "./fixtures";

test.describe("New Tab Tests", () => {
  test("should click on 'See all tests' and verify navigation", async ({ loggedInPage }) => {
    // Navigate to the specific test run page
    await loggedInPage.goto("https://dash.empirical.run/lorem-ipsum-tests/test-runs/23649?group_by=none&status=none");
    
    // Click on the "See all tests" link
    await loggedInPage.getByRole('link', { name: 'See all tests' }).click();
    
    // Verify that we navigate to the tests listing page
    await expect(loggedInPage).toHaveURL(/\/lorem-ipsum-tests\/tests/);
    
    // Verify that the tests page is loaded by checking for test-related content
    await expect(loggedInPage.getByText("Tests")).toBeVisible();
  });
});