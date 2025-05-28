import { test, expect } from "./fixtures";

test.describe("New Tab Navigation", () => {
  test("click on See all tests button", async ({ loggedInPage }) => {
    // Navigate to the specific test run page
    await loggedInPage.goto("https://dash.empirical.run/lorem-ipsum-tests/test-runs/23649?group_by=none&status=none");
    
    // Click on the "See all tests" button
    await loggedInPage.getByRole('link', { name: 'See all tests' }).click();
  });
});