import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";
import {
  getFailedTestRunDetails,
  goToTestRun,
  expectTestCasesCount,
  reRunFailedTests,
  triggerTestRunForEnvironmentAndNavigate,
} from "./pages/test-runs";
import { waitForRunEnded, getRunDetail } from "./pages/test-case-ids";
import { selectUnsnoozedFixtureCase } from "./pages/snooze-fixture";
import { getApiWorkerAuthHeaders } from "./pages/api-auth";
import { getApiBaseUrl } from "./pages/urls";

test.describe("Snooze Tests", () => {
  let createdSnoozeId: number | undefined;

  test.beforeEach(() => {
    createdSnoozeId = undefined;
  });

  test.afterEach(async ({ page }) => {
    // Expire only the snooze created by this attempt, even if later assertions fail.
    if (createdSnoozeId === undefined) return;
    const response = await page.request.patch(
      `${getApiBaseUrl()}/api/snoozes/${createdSnoozeId}`,
      {
        headers: await getApiWorkerAuthHeaders(page),
        data: { expire_now: true },
      },
    );
    await expect(response).toBeOK();
  });

  test("snooze failed test and verify re-run shows snoozed status", async ({
    page,
  }) => {
    const fixtureTestId = await selectUnsnoozedFixtureCase(page);
    // Force one real failure, independent of bugs in the Lorem Ipsum deployment.
    // This override is owned by the run, not shared environment configuration.
    const testRunId = await triggerTestRunForEnvironmentAndNavigate(
      page,
      "SnoozeEnv",
      [fixtureTestId],
      "BASE_URL=https://example.com",
    );
    await waitForRunEnded(page, testRunId, 450000);
    const sourceFailures = await getFailedTestRunDetails(page, testRunId);
    expect(
      sourceFailures,
      "Fresh scoped run must contain one raw failure",
    ).toHaveLength(1);
    expect(sourceFailures[0].pw_test_id).toBe(fixtureTestId);
    expect(
      sourceFailures[0].snooze_info ?? [],
      "Our fixture must not already be snoozed",
    ).toHaveLength(0);

    // Own the comparison run too: historical staging failures can disappear or
    // already be snoozed. Use the identical case and intentional failure there.
    const stagingTestRunId = await triggerTestRunForEnvironmentAndNavigate(
      page,
      "staging",
      [fixtureTestId],
      "BASE_URL=https://example.com",
    );
    await waitForRunEnded(page, stagingTestRunId, 450000);
    const stagingFailures = await getFailedTestRunDetails(
      page,
      stagingTestRunId,
    );
    expect(stagingFailures).toHaveLength(1);
    expect(stagingFailures[0].pw_test_id).toBe(fixtureTestId);
    expect(stagingFailures[0].snooze_info ?? []).toHaveLength(0);

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
    createdSnoozeId = snooze.id;
    expect(response.ok()).toBe(true);
    expect(createdSnoozeId).toBeTruthy();
    expect(snooze.description).toBe(description);
    expect(snooze.test_ids).toEqual([fixtureTestId]);
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
    const rerunId = await reRunFailedTests(page, testRunId);
    const rerun = await waitForRunEnded(page, rerunId, 450000);
    expect(rerun.failed_count).toBe(1);
    expect(rerun.failed_count_after_snoozing).toBe(0);
    await page.reload();
    await expect(
      page.getByText("Test run on SnoozeEnv").locator("..").getByText("Passed"),
    ).toBeVisible();
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
    ).toContain(createdSnoozeId);
  });
});
