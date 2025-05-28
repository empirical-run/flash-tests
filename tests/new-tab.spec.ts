import { expect, test } from "./fixtures";

test.describe("New Tab Navigation", () => {
  test("should open 'See all tests' in new tab from test run page", async ({ loggedInPage }) => {
    // Navigate to the specific test run page
    await loggedInPage.goto("https://dash.empirical.run/flash-tests/test-runs/23649?group_by=none&status=none");
    
    // TODO(agent on loggedInPage): Click on "See all tests" button to open it in a new tab
  });
});