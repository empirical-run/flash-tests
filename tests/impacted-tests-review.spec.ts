import { test, expect } from "./fixtures";
import { createSession, navigateToSessions, openReviewPanel } from "./pages/sessions";

test.describe('Impacted Tests Review', () => {
  test('create session, modify test, and verify impacted tests in review tab', async ({ page, trackCurrentSession, withSandboxSession }) => {
    await navigateToSessions(page);

    // Step 1: Create a new session with the message to modify login.spec.ts
    const message = "modify the test in tests/login.spec.ts to use user@example.com as the input email. make no other change. then commit the change.";
    await createSession(page, message);

    // Track the session for automatic cleanup
    trackCurrentSession(page);

    // Step 2: Wait for the edit to complete
    // In sandbox mode, tools show as "Used <tool> tool" instead of file-specific text
    // First, wait for the agent to read the file
    await expect(page.getByText(/Used read/)).toBeVisible({ timeout: 120000 });

    // Wait for the edit tool to complete
    await expect(page.getByText(/Used edit/)).toBeVisible({ timeout: 120000 });

    // Step 3: Wait for impacted tests to be computed (sandbox mode needs more time)
    await page.waitForTimeout(20000);

    // Step 4: Reload the page
    await page.reload();

    // Step 5: Reload the page again to ensure impacted tests are fully computed in sandbox mode
    await page.reload();

    // Step 6: Open Review tab and get the dialog
    const reviewDialog = await openReviewPanel(page);

    // Step 8: Wait for the impacted tests to load - look for "Impacted Tests (1)" tab instead of "(0)"
    await expect(reviewDialog.getByRole('tab', { name: /Impacted Tests \(1\)/ })).toBeVisible({ timeout: 60000 });

    // Step 9: Switch to Impacted Tests tab within the Review dialog
    await reviewDialog.getByRole('tab', { name: /Impacted Tests/ }).click();

    // Step 10: Assert that the text "click login button and input dummy email" is visible within the dialog
    // This is the test name shown in the impacted tests section
    await expect(reviewDialog.getByText("click login button and input dummy email")).toBeVisible();

    // Session will be automatically closed by afterEach hook
  });
});
