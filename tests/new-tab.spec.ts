import { expect, test } from "./fixtures";

test.describe("New Tab Navigation", () => {
  test("should open 'See all tests' in new tab from test run page", async ({ loggedInPage, context }) => {
    // Navigate to the specific test run page
    await loggedInPage.goto("https://dash.empirical.run/flash-tests/test-runs/23649?group_by=none&status=none");
    
    // Wait for the page to load completely
    await loggedInPage.waitForLoadState('networkidle');
    
    // Listen for new page events to capture the new tab
    const pagePromise = context.waitForEvent('page');
    
    // Click on the "See all tests" button (the agent found it at coordinates 1249, 116)
    await loggedInPage.click('body', { position: { x: 1249, y: 116 } });
    
    // Wait for the new page to open
    const newPage = await pagePromise;
    await newPage.waitForLoadState();
    
    // Verify that the new page opened with the correct URL (should be the tests list page)
    expect(newPage.url()).toMatch(/flash-tests\/tests/);
    
    // Clean up - close the new tab
    await newPage.close();
  });
});