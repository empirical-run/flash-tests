import { test, expect } from "./fixtures";

test.describe("New Tab Navigation", () => {
  test("should navigate to test list when clicking 'See all tests'", async ({ loggedInPage }) => {
    // Navigate to the specific test run page
    await loggedInPage.goto("https://dash.empirical.run/lorem-ipsum-tests/test-runs/23649?group_by=none&status=none");
    
    // TODO(agent on loggedInPage): Click on the "See all tests" button
    
    // Assert that we navigate to the tests list page
    await expect(loggedInPage).toHaveURL(/\/lorem-ipsum-tests\/tests/);
    
    // Assert that the page shows the test list
    await expect(loggedInPage.getByRole("heading", { name: /tests/i })).toBeVisible();
  });
});