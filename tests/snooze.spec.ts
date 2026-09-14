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
    
    // Extract the time portion from our snooze description to find the exact row
    const timeMatch = snoozeDescription.match(/(\d{2}:\d{2}:\d{2})/);
    const timeString = timeMatch ? timeMatch[1] : '';
    
    // Find the table row containing our snooze by the time string in the description
    const snoozeRow = page.getByRole('row').filter({ hasText: timeString });
    await expect(snoozeRow).toBeVisible();
    
    // Click the Expire button within this specific row
    const expireButton = snoozeRow.getByRole('button', { name: 'Expire' });
    await expect(expireButton).toBeVisible();
    await expireButton.click();
    
    // Wait for the snooze to be moved to "Expired" section
    await page.waitForTimeout(2000);
    
  });

  test("snooze failed test and verify re-run shows snoozed status", async ({ page }) => {
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

    // Read the completed run's current failure details. Filtering on live
    // snooze_info is still intentional defense in depth: another actor could
    // theoretically snooze a case between this dedicated run ending and this
    // test creating its own snooze.
    const sourceFailedDetails = await getFailedTestRunDetails(page, testRunId);
    expect(sourceFailedDetails, 'Scoped SnoozeEnv run should contain only its fixture failure').toHaveLength(1);
    expect(sourceFailedDetails[0].pw_test_id).toBe(snoozeFixtureTestId);
    const unsnoozedFailedDetails = sourceFailedDetails.filter(
      (detail: any) => !(detail.snooze_info?.length > 0),
    );
    expect(
      unsnoozedFailedDetails.length,
      'Fresh SnoozeEnv run should have a failure that is not already snoozed',
    ).toBeGreaterThan(0);
    const failedPwTestId = unsnoozedFailedDetails[0].pw_test_id;
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
    snoozeDescription = `Test snooze at ${currentTime}`;
    
    // Select every failure that is not already snoozed. Existing snoozes are left
    // intact; the new bulk snooze makes every failed case in this source run snoozed.
    for (const failedDetail of unsnoozedFailedDetails) {
      const checkbox = page
        .locator(`tbody tr:has(a[href*="test_id=${failedDetail.pw_test_id}"])`)
        .getByRole('checkbox');
      await checkbox.click();
      await expect(checkbox).toBeChecked();
    }
    
    // Wait for the action bar to show the expected bulk-selection count.
    await expect(
      page.getByText(`${unsnoozedFailedDetails.length} test${unsnoozedFailedDetails.length === 1 ? '' : 's'} selected`),
    ).toBeVisible();
    
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
    
    // Click the "Create Snooze" button to apply the snooze
    await page.getByRole('button', { name: 'Create Snooze' }).click();
    
    // Wait for the dialog to close
    await expect(page.getByRole('dialog')).not.toBeVisible();
    
    // Wait a moment for the page to update after snooze creation
    await page.waitForTimeout(1000);
    
    // Every raw failure is now snoozed: some may have been snoozed before this
    // test, and the rest were covered by the bulk snooze above.
    for (const failedDetail of sourceFailedDetails) {
      const testRow = page.locator(`tbody tr:has(a[href*="test_id=${failedDetail.pw_test_id}"])`).first();
      await expect(testRow.locator('svg.lucide-alarm-clock-off').first()).toBeVisible();
    }

    // Verify the environment-scoped snooze does not apply to the same failed
    // Playwright test ID in staging.
    await goToTestRun(page, stagingTestRunId);
    await expect(page.getByRole('heading', { name: 'Test run on staging' })).toBeVisible();
    const stagingTestRow = page.locator(`tbody tr:has(a[href*="test_id=${failedPwTestId}"])`).first();
    await expect(stagingTestRow).toBeVisible();
    await expect(stagingTestRow.locator('svg.lucide-alarm-clock-off')).not.toBeVisible();

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
