import { test, expect } from "./fixtures";
import { setVideoLabel } from "@empiricalrun/playwright-utils/test";
import {
  getRecentFailedTestRunForEnvironment,
  goToTestRun,
  searchFailureTestName,
} from "./pages/test-runs";
import {
  verifyLastSuccessfulRun,
  verifySearchVideosAndComparison,
} from "./pages/step-comparison";

test.describe("Test Case Report", () => {
  test("Compare Steps explains missing passing history for a failed search", async ({
    page,
  }) => {
    setVideoLabel(page, "compare-steps-no-passing-history");
    await page.goto("/");
    const { testRunId } = await getRecentFailedTestRunForEnvironment(
      page,
      "production",
      {
        requiredFailedTestName: searchFailureTestName,
      },
    );
    await goToTestRun(page, testRunId);
    await page
      .getByRole("link", { name: searchFailureTestName, exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`test-runs/${testRunId}\\?test_id=`),
    );
    await verifySearchVideosAndComparison(page);
  });

  test("last succesful run info loads", async ({ page }) => {
    setVideoLabel(page, "last-successful-run");

    // Navigate to the app first to establish session/authentication
    await page.goto("/");

    // Fetch a failed test run for the production environment
    // This uses the lorem-ipsum project's production environment
    const { testRunId } = await getRecentFailedTestRunForEnvironment(
      page,
      "production",
      { requiredFailedTestName: "click login button and input dummy email" },
    );

    // Navigate to the test run page
    await goToTestRun(page, testRunId);

    // The exact failed test link is the readiness/identity landmark.
    await expect(
      page.getByRole("link", {
        name: "click login button and input dummy email",
        exact: true,
      }),
    ).toBeVisible();

    // Find the "login" test case link in the failed tests results table and click on it
    // The login test in lorem-ipsum is "click login button and input dummy email"
    await page
      .getByRole("link", {
        name: "click login button and input dummy email",
        exact: true,
      })
      .click();

    // Wait for the test case detail page to load (URL includes ?test_id= query param)
    await expect(page).toHaveURL(
      new RegExp(`test-runs/${testRunId}\\?test_id=`),
    );

    await verifyLastSuccessfulRun(page, testRunId);
  });
});
