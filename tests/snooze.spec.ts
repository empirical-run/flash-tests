import { randomUUID } from "node:crypto";
import { test as base, expect } from "./fixtures";
import {
  getFailedTestRunDetails,
  goToTestRun,
  expectTestCasesCount,
  reRunFailedTests,
} from "./pages/test-runs";
import { waitForRunEnded, getRunDetail } from "./pages/test-case-ids";
import {
  createSnoozeFixture,
  triggerSnoozeFixtureRun,
  deleteSnoozeFixture,
} from "./pages/snooze-fixture";
import { expireSnoozeAndVerify } from "./pages/snoozes";

const test = base.extend<{ createdSnooze: { id?: number; branch?: string } }>({
  createdSnooze: async ({}, use) => {
    await use({});
  },
});

test.describe("Snooze Tests", () => {
  test.afterEach(async ({ page, createdSnooze }) => {
    test.setTimeout(120000);
    if (createdSnooze.id !== undefined) {
      await expireSnoozeAndVerify(page, createdSnooze.id);
    }
  });

  // Separate hooks ensure branch cleanup still runs if snooze cleanup fails.
  test.afterEach(async ({ page, createdSnooze }) => {
    test.setTimeout(120000);
    if (createdSnooze.branch !== undefined) {
      await deleteSnoozeFixture(page, createdSnooze.branch);
    }
  });

  test("snooze failed test and verify re-run shows snoozed status", async ({
    page,
    createdSnooze,
  }) => {
    const branch = `flash-snooze-fixture-${randomUUID()}`;
    // Capture ownership before setup so failed commits/triggers also clean up.
    createdSnooze.branch = branch;
    await createSnoozeFixture(page, branch);
    const testRunId = await triggerSnoozeFixtureRun(
      page,
      branch,
      "env-to-test-snoozes",
    );
    const sourceRun = await waitForRunEnded(page, testRunId, 450000);
    expect(sourceRun.total_count).toBe(1);
    expect(sourceRun.failed_count).toBe(1);
    expect(sourceRun.failed_count_after_snoozing).toBe(1);
    const sourceFailures = await getFailedTestRunDetails(page, testRunId);
    expect(
      sourceFailures,
      "Fresh scoped run must contain one raw failure",
    ).toHaveLength(1);
    expect(sourceFailures[0].nesting).toEqual([
      `${branch}.spec.ts`,
      "intentional snooze fixture failure",
    ]);
    expect(sourceFailures[0].test_project).toBe("chromium");
    const fixtureTestId = sourceFailures[0].pw_test_id;
    expect(fixtureTestId).toMatch(/^[a-f0-9]{20}-[a-f0-9]{20}$/);
    expect(
      sourceFailures[0].snooze_info ?? [],
      "Our fixture must not already be snoozed",
    ).toHaveLength(0);

    // Run the SAME isolated case in staging to prove environment-only scope.
    const stagingTestRunId = await triggerSnoozeFixtureRun(
      page,
      branch,
      "staging",
    );
    const stagingRun = await waitForRunEnded(page, stagingTestRunId, 450000);
    expect(stagingRun.total_count).toBe(1);
    expect(stagingRun.failed_count).toBe(1);
    expect(stagingRun.failed_count_after_snoozing).toBe(1);
    const stagingFailures = await getFailedTestRunDetails(
      page,
      stagingTestRunId,
    );
    expect(stagingFailures).toHaveLength(1);
    expect(stagingFailures[0].pw_test_id).toBe(fixtureTestId);
    expect(stagingFailures[0].snooze_info ?? []).toHaveLength(0);

    // The comparison run takes time; recheck live coverage before creating ours.
    const currentSourceFailures = await getFailedTestRunDetails(
      page,
      testRunId,
    );
    expect(currentSourceFailures).toHaveLength(1);
    expect(currentSourceFailures[0].snooze_info ?? []).toHaveLength(0);
    await goToTestRun(page, testRunId);
    await expect(
      page.getByRole("combobox").filter({ hasText: "Failed" }),
    ).toBeVisible();
    await expectTestCasesCount(page, 1);
    const sourceRow = page.locator(
      `tbody tr:has(a[href*="test_id=${fixtureTestId}"])`,
    );
    await sourceRow.getByRole("checkbox").check();
    await expect(
      page.getByText("1 test selected", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Snooze", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Snooze Test Cases")).toBeVisible();
    await dialog.getByRole("combobox").filter({ hasText: "1 day" }).click();
    await page.getByRole("option", { name: "1 hour" }).click();
    const description = `Test snooze ${randomUUID()}`;
    await dialog.locator("textarea").fill(description);
    await dialog
      .getByRole("checkbox", { name: "Only snooze for SnoozeEnv" })
      .check();

    const creationResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/snoozes") &&
        response.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Create Snooze" }).click();
    const response = await creationResponse;
    const snooze = (await response.json()).data.snooze;
    createdSnooze.id = snooze.id;
    expect(response.ok()).toBe(true);
    expect(createdSnooze.id).toBeTruthy();
    expect(snooze.description).toBe(description);
    expect(snooze.test_ids).toEqual([fixtureTestId]);
    expect(snooze.created_from_test_run_id).toBe(testRunId);
    expect(snooze.scoped_to_environment_id).toBe(
      (await getRunDetail(page, testRunId)).environment_id,
    );
    await expect(dialog).not.toBeVisible();
    await expect(
      sourceRow.locator("svg.lucide-alarm-clock-off").first(),
    ).toBeVisible();

    await goToTestRun(page, stagingTestRunId);
    await expect(
      page.getByRole("heading", { name: "Test run on staging" }),
    ).toBeVisible();
    const stagingRow = page.locator(
      `tbody tr:has(a[href*="test_id=${fixtureTestId}"])`,
    );
    await expect(stagingRow).toBeVisible();
    await expect(
      stagingRow.locator("svg.lucide-alarm-clock-off"),
    ).not.toBeVisible();
    const comparisonFailures = await getFailedTestRunDetails(
      page,
      stagingTestRunId,
    );
    expect(comparisonFailures).toHaveLength(1);
    expect(comparisonFailures[0].snooze_info ?? []).toHaveLength(0);

    await goToTestRun(page, testRunId);
    // Wait for the source results to hydrate, not just its server-rendered
    // header; otherwise a click on Re-run can precede its event handlers.
    await expectTestCasesCount(page, 1);
    await expect(
      sourceRow.locator("svg.lucide-alarm-clock-off").first(),
    ).toBeVisible();
    const rerunId = await reRunFailedTests(page, testRunId);
    const rerun = await waitForRunEnded(page, rerunId, 450000);
    expect(rerun.total_count).toBe(1);
    expect(rerun.failed_count).toBe(1);
    expect(rerun.failed_count_after_snoozing).toBe(0);
    await page.reload();
    // Role lookup excludes hidden streamed headers; bind the badge to THIS run.
    const rerunHeading = page.getByRole("heading", {
      name: new RegExp(`^Test run on SnoozeEnv #\\s*${rerunId}$`),
    });
    await expect(rerunHeading).toBeVisible();
    const statusBadge = rerunHeading
      .locator("..")
      .locator('[data-slot="badge"]');
    await expect(statusBadge).toHaveCount(1);
    await expect(statusBadge).toBeVisible();
    await expect(statusBadge).toHaveText("Passed");
    await expectTestCasesCount(page, 1);
    await expect(
      page.getByRole("combobox").filter({ hasText: "Failed" }),
    ).toBeVisible();
    const rerunRow = page.locator(
      `tbody tr:has(a[href*="test_id=${fixtureTestId}"])`,
    );
    await expect(
      rerunRow.locator("svg.lucide-alarm-clock-off").first(),
    ).toBeVisible();

    // A passing header alone is insufficient: prove the same case still failed
    // and THIS attempt's snooze covered it (not a passing case or another snooze).
    const rerunFailures = await getFailedTestRunDetails(page, rerunId);
    expect(rerunFailures).toHaveLength(1);
    expect(rerunFailures[0].pw_test_id).toBe(fixtureTestId);
    expect(
      rerunFailures[0].snooze_info.map((info: any) => info.snooze_id),
    ).toEqual([createdSnooze.id]);
  });
});
