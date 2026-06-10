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

    // Wait for the test case detail page to load (URL includes ?test_id= query param)
    await expect(page).toHaveURL(/test_id=/);

    // Extract the Playwright test id from the URL. The report UI now identifies the selected
    // detail row by test_id in the URL; resolve it to the diagnosis slug through the test-run API
    // before calling the diagnosis API.
    const url = new URL(page.url());
    const testId = url.searchParams.get("test_id");
    expect(testId).toBeTruthy();

    const testRunResponse = await page.request.get(`/api/test-runs/${testRunId}`);
    await expect(testRunResponse).toBeOK();
    const testRunData = await testRunResponse.json();
    const matchingDiagnosis = testRunData.data.test_run.flattenedSummaryDetails.find(
      (detail: { pw_test_id: string }) => detail.pw_test_id === testId
    );
    expect(matchingDiagnosis?.slug).toBeTruthy();

    // Call the diagnosis API with the slug and verify last successful run info is returned
    const diagnosisResponse = await page.request.get(`/api/diagnosis/${matchingDiagnosis.slug}/detailed`);
    await expect(diagnosisResponse).toBeOK();
    const diagnosisData = await diagnosisResponse.json();
    expect(diagnosisData.data.test_case.metadata.last_successful_run).toBeTruthy();

    // Verify we are on the test case detail page by checking that the
    // "Visual Comparison" section is visible - this section shows both the
    // current run's video and the last successful run's video side by side
    await expect(page.getByText("Visual Comparison")).toBeVisible();

    // Verify the "Last successful run" panel label is visible within the Visual Comparison section.
    // The label element contains nested inline links "(test run · test case)", so we scope to the
    // section's <h4> parent container rather than using { exact: true } on the full element text.
    const visualComparisonSection = page.locator("h4", { hasText: "Visual Comparison" }).locator("..");
    await expect(visualComparisonSection.getByText("Last successful run")).toBeVisible({ timeout: 30000 });

    // Verify the "This run" panel label is visible (the current failing run)
    await expect(page.getByText("This run")).toBeVisible();

    // Verify both video players are present in the page:
    // - one for the current (failing) run
    // - one for the last successful run
    await expect(page.locator("video")).toHaveCount(2);

    // Hover over the "test run" link next to "Last successful run" —
    // a tooltip should appear showing the environment name ("staging")
    await page.getByRole("link", { name: "test run", exact: true }).hover();
    await expect(page.getByRole("tooltip")).toContainText("staging");

    // Click the "test case" link next to "Last successful run" which opens the
    // Playwright HTML report in a new tab with that specific test case open
    const testCaseReportPagePromise = page.waitForEvent("popup");
    await page.getByRole("link", { name: "test case", exact: true }).click();
    const testCaseReportPage = await testCaseReportPagePromise;
    setVideoLabel(testCaseReportPage, "test-case-html-report");

    // Verify the HTML report opens (URL should contain the report HTML file)
    await expect(testCaseReportPage).toHaveURL(/\.html/);

    // Verify the login test case name is visible in the report
    await expect(
      testCaseReportPage.getByText("click login button and input dummy email")
    ).toBeVisible();
  });
});
