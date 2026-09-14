import { test, expect } from "./fixtures";
import {
  getFailedTestRunDetails,
  getTestRunWithFailedPwTestIdForEnvironment,
  goToTestRun,
  expectTestCasesCount,
  reRunFailedTests,
  triggerTestRunForEnvironmentAndNavigate,
} from "./pages/test-runs";
import {
  listLoremTestCases,
  LOREM_TEST_CASE_NAMES,
  resolveTestCaseIds,
  waitForRunEnded,
} from "./pages/test-case-ids";

test.describe("Snooze Tests", () => {
  let snoozeDescription: string;

  test.afterEach(async ({ page }) => {
    // Clean up: Expire the snooze we created
    if (!snoozeDescription) return;

    // Navigate directly to Snoozes. In the new layout this link lives in the
    // More overflow menu and may not be visible from the current page state.
    await page.goto('/lorem-ipsum/snoozes');
    
    // Wait for the Snoozes page to load
    await expect(page).toHaveURL(/snoozes/);
    
    // Wait for Active section to be visible
    await expect(page.getByText('Active', { exact: false })).toBeVisible();
    
    // Match the unique description rather than a display timestamp, which can
    // collide with another worker or retry creating a snooze in the same second.
    const snoozeRow = page.getByRole('row').filter({ hasText: snoozeDescription });
    await expect(snoozeRow).toBeVisible();
    
    // Click the Expire button within this specific row
    const expireButton = snoozeRow.getByRole('button', { name: 'Expire' });
    await expect(expireButton).toBeVisible();
    await expireButton.click();
    
    // Wait for the snooze to be moved to "Expired" section
    await page.waitForTimeout(2000);
    
  });

  test("snooze failed test and verify re-run shows snoozed status", async ({ page }, testInfo) => {
    // Create this test's own fixture run instead of scavenging shared run
    // history. Scope it to the database-search fixture that SnoozeEnv is
    // designed to fail, so the run cannot update successful-run history for
    // unrelated shared cases such as login.
    const testCases = await listLoremTestCases(page);
    const [snoozeFixtureTestId] = resolveTestCaseIds(testCases, [
      LOREM_TEST_CASE_NAMES.searchDatabase,
    ]);
    const testRunId = await triggerTestRunForEnvironmentAndNavigate(
      page,
      'SnoozeEnv',
      [snoozeFixtureTestId],
    );
    await waitForRunEnded(page, testRunId, 450000);

    // The raw failure is owned by this run, but its test-case identity is shared
    // fixture data and may already have an unrelated active snooze. That must not
    // prevent this test from creating and identifying its own environment-scoped
    // snooze.
    const sourceFailedDetails = await getFailedTestRunDetails(page, testRunId);
    expect(
      sourceFailedDetails,
      'Scoped SnoozeEnv run should contain only its fixture failure',
    ).toHaveLength(1);
    expect(sourceFailedDetails[0].pw_test_id).toBe(snoozeFixtureTestId);
    const failedPwTestId = sourceFailedDetails[0].pw_test_id;
    expect(failedPwTestId).toBeTruthy();

    // Find the same failing test in staging so we can prove the SnoozeEnv-scoped
    // snooze does not apply to another environment.
    const { testRunId: stagingTestRunId } = await getTestRunWithFailedPwTestIdForEnvironment(
      page,
      'staging',
      failedPwTestId,
    );
    
    // Navigate to the test run
    await goToTestRun(page, testRunId);
    
    // Wait for the test run page to load with the default Failed status filter.
    await expect(page.getByRole('combobox').filter({ hasText: 'Failed' })).toBeVisible();
    await expectTestCasesCount(page, sourceFailedDetails.length);
    
    // Get current time to use in snooze description
    const currentTime = new Date().toLocaleString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: false 
    });
    snoozeDescription = `Test snooze ${testInfo.parallelIndex}-${Date.now()} at ${currentTime}`;

    // Select this run's single raw failure even if an unrelated snooze already
    // applies to the shared test-case ID. The snooze created below is tracked by
    // its own API ID, so overlapping fixture snoozes cannot be mistaken for it.
    const checkbox = page
      .locator(`tbody tr:has(a[href*="test_id=${failedPwTestId}"])`)
      .getByRole('checkbox');
    await checkbox.click();
    await expect(checkbox).toBeChecked();
    await expect(page.getByText('1 test selected')).toBeVisible();
    
    // Click on the "Snooze" button in the bulk actions bar. The page also
    // has a "Snoozes (N)" tab, so use an exact accessible-name match here.
    await page.getByRole('button', { name: 'Snooze', exact: true }).click();
    
    // Wait for the snooze dialog to appear
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Snooze Test Cases')).toBeVisible();
    
    // Click on the Duration dropdown
    await page.getByRole('combobox').filter({ hasText: '1 day' }).click();
    
    // Select "1 hour" option
    await page.getByRole('option', { name: '1 hour' }).click();
    
    // Enter the description
    const descriptionField = page.getByRole('dialog').locator('textarea');
    await descriptionField.clear();
    await descriptionField.fill(snoozeDescription);
    
    // Scope the snooze to the environment
    await page.getByRole('checkbox', { name: 'Only snooze for SnoozeEnv' }).click();
    
    // Capture the identity of this test's snooze. Assertions below compare this
    // ID rather than treating any snooze icon on shared fixture data as ours.
    const createSnoozeResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/snoozes' &&
        response.ok(),
    );
    await page.getByRole('button', { name: 'Create Snooze' }).click();
    const createSnoozeResponse = await createSnoozeResponsePromise;
    const createSnoozeBody = await createSnoozeResponse.json();
    const createdSnoozeId = createSnoozeBody.data.snooze.id;
    expect(createdSnoozeId).toBeTruthy();
    
    // Wait for the dialog to close
    await expect(page.getByRole('dialog')).not.toBeVisible();
    
    // Wait a moment for the page to update after snooze creation
    await page.waitForTimeout(1000);
    
    const updatedSourceFailure = (await getFailedTestRunDetails(page, testRunId))[0];
    expect(
      updatedSourceFailure.snooze_info.some(
        (snooze: any) => Number(snooze.snooze_id) === Number(createdSnoozeId),
      ),
      'The source failure should include the snooze created by this test',
    ).toBe(true);

    // Verify this exact SnoozeEnv-scoped snooze does not apply in staging. An
    // unrelated global snooze may legitimately make the staging row look
    // snoozed, so compare IDs instead of asserting that no snooze icon exists.
    const stagingFailure = (await getFailedTestRunDetails(page, stagingTestRunId)).find(
      (detail: any) => detail.pw_test_id === failedPwTestId,
    );
    expect(stagingFailure).toBeTruthy();
    expect(
      (stagingFailure.snooze_info ?? []).some(
        (snooze: any) => Number(snooze.snooze_id) === Number(createdSnoozeId),
      ),
      'The SnoozeEnv-scoped snooze should not apply to staging',
    ).toBe(false);

    await goToTestRun(page, testRunId);
    await expect(page.getByRole('combobox').filter({ hasText: 'Failed' })).toBeVisible();
    await expectTestCasesCount(page, sourceFailedDetails.length);
    
    
    // Re-run all failed tests. Because both pre-existing snoozes and the snooze
    // created above cover every raw failure, the re-run should pass.
    await reRunFailedTests(page, testRunId);
    
    // Wait for run to complete - wait up to 5 mins
    // The "Passed" badge appears in the header when tests complete (snoozed failures don't count)
    await expect(page.locator('text=Test run on SnoozeEnv').locator('..').getByText('Passed')).toBeVisible({ timeout: 300000 }); // 5 minutes timeout
    
    // Reload the page to ensure UI is fully updated
    await page.reload();
    
    // Wait for the page to load after reload
    await expect(page.getByText('Test run on SnoozeEnv')).toBeVisible();
    
    // Every failed test from the source run was re-run.
    await expectTestCasesCount(page, sourceFailedDetails.length);
    
    // The test should still show in the Failed status filter (snoozed tests still count as failures).
    await expect(page.getByRole('combobox').filter({ hasText: 'Failed' })).toBeVisible();
    
    // Every failed test row should retain its snoozed status in the re-run.
    for (const failedDetail of sourceFailedDetails) {
      const newTestRow = page.locator(`tbody tr:has(a[href*="test_id=${failedDetail.pw_test_id}"])`).first();
      await expect(newTestRow.locator('.lucide.lucide-alarm-clock-off').first()).toBeVisible();
    }
    
    // Verify the overall result shows the raw failure count.
    await expect(page.getByText(String(sourceFailedDetails.length), { exact: true }).first()).toBeVisible();
    
  });
});
