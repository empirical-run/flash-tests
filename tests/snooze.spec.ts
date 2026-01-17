import { test, expect } from "./fixtures";
import { getTestRunWithOneFailureForEnvironment, goToTestRun } from "./pages/test-runs";

test.describe("Snooze Tests", () => {
  let snoozeDescription: string;

  test.afterEach(async ({ page }) => {
    // Clean up: Expire the snooze we created
    if (!snoozeDescription) return;

    // Navigate to Snoozes page
    await page.getByRole('link', { name: 'Snoozes' }).click();
    
    // Wait for the Snoozes page to load
    await expect(page).toHaveURL(/snoozes/);
    
    // Wait for Active section to be visible
    await expect(page.getByText('Active', { exact: false })).toBeVisible();
    
    // Extract the time portion from our snooze description to find the exact row
    const timeMatch = snoozeDescription.match(/(\d{2}:\d{2}:\d{2})/);
    const timeString = timeMatch ? timeMatch[1] : '';
    
    // Find the card containing our snooze by the time string in the description
    const snoozeCard = page.locator('div.rounded-md.border').filter({ hasText: timeString });
    await expect(snoozeCard).toBeVisible({ timeout: 5000 });
    
    // Click the Expire button within this specific card
    const expireButton = snoozeCard.getByRole('button', { name: 'Expire' });
    await expect(expireButton).toBeVisible({ timeout: 5000 });
    await expireButton.click();
    
    // Wait for the snooze to be moved to "Expired" section
    await page.waitForTimeout(2000);
    
    console.log('Successfully expired snooze in cleanup');
  });

  test("snooze failed test and verify re-run shows snoozed status", async ({ page }) => {
    // Navigate to the app first to establish session/authentication
    await page.goto("/");
    
    // Find a test run with exactly 1 failure for the env-to-test-snoozes environment
    const { testRunId } = await getTestRunWithOneFailureForEnvironment(page, 'env-to-test-snoozes');
    
    // Navigate to the test run
    await goToTestRun(page, testRunId);
    
    // Wait for the test run page to load - check for the Failed tests tab
    await expect(page.getByText('Failed tests (1)')).toBeVisible({ timeout: 10000 });
    
    // Get current time to use in snooze description
    const currentTime = new Date().toLocaleString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: false 
    });
    snoozeDescription = `Test snooze at ${currentTime}`;
    
    // Click on the checkbox for the first failed test to select it
    const firstCheckbox = page.locator('tbody tr').first().getByRole('checkbox');
    await firstCheckbox.click();
    
    // Verify checkbox is selected
    await expect(firstCheckbox).toBeChecked();
    
    // Wait for the action bar to appear showing "N test(s) selected"
    await expect(page.getByText(/\d+ test(s)? selected/)).toBeVisible();
    
    // Click on the "Snooze" button in the bulk actions bar
    await page.getByRole('button', { name: 'Snooze' }).click();
    
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
    
    // Verify the icon for the test row changed - look for the lucide-alarm-clock-off icon
    const testRow = page.locator('tbody tr').first();
    const snoozeIcon = testRow.locator('svg.lucide-alarm-clock-off').first();
    await expect(snoozeIcon).toBeVisible({ timeout: 5000 });
    
    console.log('Successfully verified snooze is applied with alarm clock icon');
    
    // Now re-run failed tests from this test run
    // Set up network interception to capture the test run creation response
    const testRunCreationPromise = page.waitForResponse(response => 
      response.url().includes('/api/test-runs') && response.request().method() === 'PUT'
    );
    
    // Click on "Re-run" dropdown button to open the menu
    await page.getByRole('button', { name: 'Re-run' }).click();
    
    // Click on "Re-run failed tests" option from the dropdown
    await page.getByRole('menuitem', { name: 'Re-run failed tests' }).click();
    
    // Wait for the test run creation response and extract the ID
    const response = await testRunCreationPromise;
    const responseBody = await response.json();
    const newTestRunId = responseBody.data.test_run.id;
    
    console.log('New test run created:', newTestRunId);
    
    // After triggering, the app automatically navigates to the new test run details page
    await page.waitForURL(`**/test-runs/${newTestRunId}`, { timeout: 10000 });
    
    // Verify the page shows this is a re-run of the original test run with failed tests only
    await expect(page.getByText(`Re-run of #${testRunId} (failed tests only)`)).toBeVisible({ timeout: 10000 });
    
    // Wait for and assert it shows queued or in progress status
    await expect(page.getByText(/Test run (queued|in progress)/)).toBeVisible({ timeout: 120000 });
    
    // Wait for run to complete - wait up to 5 mins
    // Accept any completion status (Passed, Failed, or Partial)
    await expect(page.locator('text=Test run on SnoozeEnv').locator('..').getByText(/Failed|Passed|Partial/)).toBeVisible({ timeout: 300000 }); // 5 minutes timeout
    
    // Reload the page to ensure UI is fully updated
    await page.reload();
    
    // Wait for the page to load after reload
    await expect(page.getByText('Test run on SnoozeEnv')).toBeVisible();
    
    // Assert that only 1 test was run (the failed one that was snoozed)
    await expect(page.getByText('All tests (1)')).toBeVisible();
    
    // The test should still show as failed (snoozed tests still count as failures)
    await expect(page.getByText('Failed tests (1)')).toBeVisible();
    
    // Verify the failed test row has the alarm clock off icon (it was snoozed)
    // There should be an alarm clock icon in the row to indicate it's snoozed
    const newTestRow = page.locator('tbody tr').first();
    const newSnoozeIcon = newTestRow.locator('.lucide.lucide-alarm-clock-off').first();
    await expect(newSnoozeIcon).toBeVisible({ timeout: 5000 });
    
    // Verify the overall result shows 1 failure
    await expect(page.getByText('1', { exact: true }).first()).toBeVisible();
    
    console.log('Successfully verified re-run shows snoozed status with alarm clock icon on failed test');
  });
});
