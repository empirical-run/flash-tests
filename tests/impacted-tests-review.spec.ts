import { test, expect } from "./fixtures";

test.describe('Impacted Tests Review', () => {
  test('create session, modify test, and verify impacted tests in review tab', async ({ page, trackCurrentSession }) => {
    // Navigate to homepage
    await page.goto('/');

    // Wait for successful login
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();

    // Navigate to Sessions page
    await page.getByRole('link', { name: 'Sessions', exact: true }).click();

    // Wait for sessions page to load
    await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });

    // Step 1: Create a new session with the message to modify login.spec.ts
    await page.getByRole('button', { name: 'New' }).click();
    const message = "modify the test in tests/login.spec.ts to use user@example.com as the input email. make no other change";
    await page.getByPlaceholder('Enter an initial prompt').fill(message);
    await page.getByRole('button', { name: 'Create' }).click();

    // Verify we're in a session
    await expect(page).toHaveURL(/sessions/, { timeout: 10000 });

    // Track the session for automatic cleanup
    trackCurrentSession(page);

    // Step 2: Wait for the edit to complete
    // First, wait for the agent to view the file
    await expect(page.getByText(/Viewed .+login\.spec\.ts/)).toBeVisible({ timeout: 45000 });

    // Wait for the str_replace tool to start editing
    await expect(page.getByText(/Editing.*login\.spec\.ts/)).toBeVisible({ timeout: 45000 });

    // Assert for the edit to complete - look for "Edited ..." text
    await expect(page.getByText(/Edited.*login\.spec\.ts/)).toBeVisible({ timeout: 45000 });

    // Step 3: Open Review tab
    await page.getByText('Review').click();

    // Step 4: Switch to Impacted Tests tab
    // The Review sheet should have multiple tabs - look for "Impacted Tests" tab
    await page.getByRole('tab', { name: 'Impacted Tests' }).click();

    // Step 5: Assert that the text "user is logged in successfully" is visible
    // This is the test name from login.spec.ts and should be visible in the impacted tests section
    await expect(page.getByText("user is logged in successfully")).toBeVisible({ timeout: 10000 });

    // Session will be automatically closed by afterEach hook
  });
});
