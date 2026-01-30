import { test, expect } from "./fixtures";

test.describe('Impacted Tests Review', () => {
  test('create session, modify test, and verify impacted tests in review tab', async ({ page, trackCurrentSession }) => {
    // Navigate to homepage
    await page.goto('/');

    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();

    // Navigate to Sessions page
    await page.getByRole('link', { name: 'Sessions', exact: true }).nth(1).click();

    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });

    // Step 1: Create a new session with the message to modify login.spec.ts
    await page.locator('button:has(svg.lucide-plus)').click();
    const message = "modify the test in tests/login.spec.ts to use user@example.com as the input email. make no other change";
    await page.getByPlaceholder('Enter an initial prompt').fill(message);
    await page.getByRole('button', { name: 'Create' }).click();

    // Verify we're in a session
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });

    // Track the session for automatic cleanup
    trackCurrentSession(page);

    // Step 2: Wait for the edit to complete
    // First, wait for the agent to view the file
    await expect(page.getByText(/Viewed .+login\.spec\.ts/)).toBeVisible({ timeout: 60000 });

    // Wait for the str_replace tool to start editing
    await expect(page.getByText(/Editing.*login\.spec\.ts/)).toBeVisible({ timeout: 60000 });

    // Assert for the edit to complete - look for "Edited ..." text
    await expect(page.getByText(/Edited.*login\.spec\.ts/)).toBeVisible({ timeout: 60000 });

    // Step 3: Wait 10 seconds for impacted tests to load
    await page.waitForTimeout(10000);

    // Step 4: Reload the page
    await page.reload();

    // Step 5: Open Review tab
    await page.getByRole('button', { name: 'Review' }).first().click();

    // Step 6: Get the Review dialog/sheet
    const reviewDialog = page.getByRole('dialog');

    // Step 7: Wait for the impacted tests to load - look for "Impacted Tests (1)" tab instead of "(0)"
    await expect(reviewDialog.getByRole('tab', { name: /Impacted Tests \(1\)/ })).toBeVisible({ timeout: 30000 });

    // Step 8: Switch to Impacted Tests tab within the Review dialog
    await reviewDialog.getByRole('tab', { name: /Impacted Tests/ }).click();

    // Step 9: Assert that the text "click login button and input dummy email" is visible within the dialog
    // This is the test name shown in the impacted tests section
    await expect(reviewDialog.getByText("click login button and input dummy email")).toBeVisible({ timeout: 10000 });

    // Session will be automatically closed by afterEach hook
  });
});
