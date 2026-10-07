import { test, expect } from "./fixtures";
import { setVideoLabel } from "@empiricalrun/playwright-utils/test";
import {
  getRecentFailedTestRunForEnvironment,
  goToTestRun,
  searchFailureTestName,
} from "./pages/test-runs";
import {
  expectComparisonScreenshot,
  expectNoPassingRunComparison,
  openStepComparison,
  visualComparisonSection,
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
    await expect(visualComparisonSection(page).locator("video")).toHaveCount(1);
    await expectNoPassingRunComparison(page);
    await expect(visualComparisonSection(page).locator("video")).toHaveCount(1);
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

    // Wait for the test run page to load with failed tests
    await expect(
      page.getByText("Failed", { exact: false }).first(),
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
    await expect(page).toHaveURL(/test_id=/);

    // Verify we are on the test case detail page by checking that the
    // "Visual Comparison" section is visible - this section shows both the
    // current run's video and the last successful run's video side by side
    await expect(page.getByText("Visual Comparison")).toBeVisible();

    // Scope to the closest comparison container with a video, not the heading's
    // immediate parent: Compare Steps adds a header row above the video panels.
    const comparisonSection = visualComparisonSection(page);
    await expect(
      comparisonSection.getByText("Last successful run"),
    ).toBeVisible({ timeout: 30000 });

    // Verify the "This run" panel label is visible (the current failing run)
    await expect(
      comparisonSection.getByText("This run", { exact: true }),
    ).toBeVisible();

    // Verify both video players are present in the page:
    // - one for the current (failing) run
    // - one for the last successful run
    await expect(comparisonSection.locator("video")).toHaveCount(2);

    // The initial single-pass response is replaced asynchronously by the newer
    // per-environment lookup. Make a real environment selection before reading
    // identity, so the refreshed default cannot race the tooltip/report checks.
    const passEnvironment = comparisonSection.getByRole("combobox");
    await expect(passEnvironment).toBeVisible({ timeout: 30_000 });
    const environmentName = (await passEnvironment.innerText()).trim();
    await passEnvironment.click();
    const environmentOption = page.getByRole("option", {
      name: new RegExp(
        `^${environmentName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} · #\\d+ ·`,
      ),
    });
    const historicalRunId = (await environmentOption.innerText()).match(
      /#(\d+)/,
    )![1];
    await environmentOption.click();
    const historicalRunLink = comparisonSection.getByRole("link", {
      name: "test run",
      exact: true,
    });
    await expect(historicalRunLink).toHaveAttribute(
      "href",
      new RegExp(`/test-runs/${historicalRunId}$`),
    );
    expect(Number(historicalRunId)).not.toBe(testRunId);
    const historicalReportLink = comparisonSection.getByRole("link", {
      name: "test case",
      exact: true,
    });
    await expect(historicalReportLink).toHaveAttribute(
      "href",
      /\.html#\?testId=/,
    );
    const historicalReportUrl =
      (await historicalReportLink.getAttribute("href"))!;
    const currentTestId = new URL(page.url()).searchParams.get("test_id")!;
    expect(
      new URLSearchParams(new URL(historicalReportUrl).hash.slice(2)).get(
        "testId",
      ),
    ).toBe(currentTestId);

    // Hover over the "test run" link next to "Last successful run" —
    // the run may come from any Lorem Ipsum environment, so verify the tooltip's
    // run metadata and environment-like suffix without pinning a shared fixture name.
    await historicalRunLink.hover();
    await expect(page.getByRole("tooltip")).toHaveAccessibleName(
      new RegExp(
        `^Run #${historicalRunId}\\s+.+\\s+[A-Za-z][\\w-]*(?:\\s+[A-Za-z][\\w-]*)*$`,
      ),
    );

    const dialog = await openStepComparison(page);
    // Compare Steps defaults to the newest pass across environments; the video
    // panel can select another environment. Explicitly compare the same historical
    // run we just inspected instead of assuming both defaults are identical.
    await dialog.getByRole("combobox").click({ timeout: 120_000 });
    await page
      .getByRole("option", { name: new RegExp(`#${historicalRunId}\\b`) })
      .click();
    await expect(
      dialog.getByText(
        new RegExp(
          `Last pass in #${historicalRunId} \\(.*\\) vs the failed attempt`,
        ),
      ),
    ).toBeVisible({ timeout: 120_000 });
    const passTrace = dialog.getByRole("link", {
      name: "Pass Trace",
      exact: true,
    });
    await expect(passTrace).toHaveAttribute("href", /trace\.zip/);
    const passTraceUrl = new URL(
      (await passTrace.getAttribute("href"))!,
    ).searchParams.get("trace");
    expect(passTraceUrl).toContain(
      `${historicalReportUrl.split("index.html")[0]}data/`,
    );

    // The failing click is selected initially; both actual trace screenshots must load.
    const failureHeading = dialog.getByRole("heading", {
      level: 3,
      name: /^Click .*Login/,
    });
    const failedStep = dialog
      .getByRole("button")
      .filter({ hasText: "Failed here" });
    await expect(failedStep).toHaveCount(1, { timeout: 120_000 });
    await expect(
      failedStep.getByRole("img", { name: "Passed", exact: true }),
    ).toBeVisible();
    await expect(
      failedStep.getByRole("img", { name: "Failed", exact: true }),
    ).toBeVisible();
    await expect(failureHeading).toBeVisible();
    await expect(dialog.getByText(/Failed at step 2 of 3/)).toBeVisible();
    await expect(
      dialog.getByText(/tests\/login\.spec\.ts:\d+/, { exact: true }),
    ).toBeVisible();
    await expectComparisonScreenshot(
      dialog,
      "Page after this step in the last passing run",
    );
    await expectComparisonScreenshot(
      dialog,
      "Page after this step in this run",
    );

    // Move beyond the failure: the email fill passed historically but was not executed here.
    await dialog
      .getByRole("button", { name: "Next step", exact: true })
      .click();
    await expect(
      dialog.getByRole("heading", {
        level: 3,
        name: /^Fill .*test@example\.com.*Email/,
      }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("figure", { name: /^Did not run This run/ }),
    ).toContainText("Step did not run");
    await expect(
      dialog.getByRole("img", {
        name: "Page after this step in this run",
        exact: true,
      }),
    ).toHaveCount(0);
    await expectComparisonScreenshot(
      dialog,
      "Page after this step in the last passing run",
    );
    // Navigation clamps at the end; the arrow remains enabled.
    await dialog
      .getByRole("button", { name: "Next step", exact: true })
      .click();
    await expect(
      dialog.getByRole("heading", {
        level: 3,
        name: /^Fill .*test@example\.com.*Email/,
      }),
    ).toBeVisible();

    await dialog
      .getByRole("button", { name: "Previous step", exact: true })
      .click();
    await expect(failureHeading).toBeVisible();
    await dialog
      .getByRole("button", { name: "Previous step", exact: true })
      .click();
    await expect(
      dialog.getByRole("heading", {
        level: 3,
        name: "Navigate /",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("figure", { name: /^Passed This run/ }),
    ).toBeVisible();
    await dialog
      .getByRole("button", { name: "Previous step", exact: true })
      .click();
    await expect(
      dialog.getByRole("heading", {
        level: 3,
        name: "Navigate /",
        exact: true,
      }),
    ).toBeVisible();
    await failedStep.click();
    await expect(failureHeading).toBeVisible();
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(comparisonSection.locator("video")).toHaveCount(2);

    // Opening Compare Steps populates the newer per-environment pass lookup in
    // the video panel too. Re-select our historical run before following its
    // report link, rather than allowing that refreshed default to change identity.
    await comparisonSection.getByRole("combobox").click();
    await page
      .getByRole("option", { name: new RegExp(`#${historicalRunId}\\b`) })
      .click();
    await expect(historicalRunLink).toHaveAttribute(
      "href",
      new RegExp(`/test-runs/${historicalRunId}$`),
    );
    await expect(historicalReportLink).toHaveAttribute(
      "href",
      historicalReportUrl,
    );

    // Click the "test case" link next to "Last successful run" which opens the
    // Playwright HTML report in a new tab with that specific test case open
    const testCaseReportPagePromise = page.waitForEvent("popup");
    await historicalReportLink.click();
    const testCaseReportPage = await testCaseReportPagePromise;
    setVideoLabel(testCaseReportPage, "test-case-html-report");

    // Verify the HTML report opens (URL should contain the report HTML file)
    await expect(testCaseReportPage).toHaveURL(/\.html/);
    await expect(testCaseReportPage).toHaveURL(historicalReportUrl);

    // Verify the login test case name is visible in the report
    await expect(
      testCaseReportPage.getByText("click login button and input dummy email"),
    ).toBeVisible();
  });
});
