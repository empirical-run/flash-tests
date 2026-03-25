import { test, expect } from "./fixtures";
import { setVideoLabel } from "@empiricalrun/playwright-utils/test";
import { getRecentFailedTestRunForEnvironment, goToTestRun } from "./pages/test-runs";

test.describe("Test Case Report", () => {
  test("last succesful run info loads", async ({ page }) => {
    setVideoLabel(page, "last-successful-run");

    // Navigate to the app first to establish session/authentication
    await page.goto("/");

    // Fetch a failed test run for the production environment
    const { testRunId } = await getRecentFailedTestRunForEnvironment(page, "production");

    // Navigate to the test run page
    await goToTestRun(page, testRunId);

    // Wait for the test run page to load with failed tests
    await expect(page.getByText("Failed", { exact: false }).first()).toBeVisible();

    // TODO(agent on page): Find the "login" test case link in the test results table and click on it to open the test case report page. Then verify there are 2 video players visible - one for the current failed run and one for the last successful run.
  });
});
