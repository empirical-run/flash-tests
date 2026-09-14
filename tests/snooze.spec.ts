import { test, expect } from "./fixtures";
import {
  getFailedTestRunDetails,
  getRecentFailedTestRunForEnvironment,
  getTestRunWithFailedPwTestIdForEnvironment,
  goToTestRun,
  expectTestCasesCount,
  reRunFailedTests,
} from "./pages/test-runs";

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
    // Navigate to the app first to establish session/authentication
    await page.goto("/");
    
    // Use any completed run with at least one unsnoozed failure. Requiring exactly
    // one made this test depend on known issues remaining unsnoozed, even though
    // snoozing those issues is expected and healthy.
    const {
      testRunId,
      failedDetails: sourceFailedDetails,
      unsnoozedFailedDetails,
    } = await getRecentFailedTestRunForEnvironment(page, 'env-to-test-snoozes');
    expect(unsnoozedFailedDetails.length).toBeGreaterThan(0);
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
