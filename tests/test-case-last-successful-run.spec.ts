import { test, expect } from "./fixtures";
import { setVideoLabel } from "@empiricalrun/playwright-utils/test";
import { getRecentFailedTestRunForEnvironment, goToTestRun } from "./pages/test-runs";

test.describe("Test Case Report", () => {
  test("last succesful run info loads", async ({ page }) => {
    setVideoLabel(page, "last-successful-run");

    // Navigate to the app first to establish session/authentication
    await page.goto("/");

    // Fetch a failed test run for the production environment
    // This uses the lorem-ipsum project's production environment
    const { testRunId } = await getRecentFailedTestRunForEnvironment(page, "production");

    // Navigate to the test run page
    await goToTestRun(page, testRunId);

    // Wait for the test run page to load with failed tests
    await expect(page.getByText("Failed", { exact: false }).first()).toBeVisible();

    // Find the "login" test case link in the failed tests results table and click on it
    // The login test in lorem-ipsum is "click login button and input dummy email"
    await page.getByRole("link", { name: /login/i }).first().click();

    // Wait for the test case detail page to load
    await expect(page).toHaveURL(/detail=/);

    // Verify the page shows a video for the current (failing) run
    const firstVideo = page.locator("video").first();
    await expect(firstVideo).toBeVisible();

    // Verify there are exactly 2 videos - one for the current failure run
    // and one for the last successful run
    await expect(page.locator("video")).toHaveCount(2);
  });
});
