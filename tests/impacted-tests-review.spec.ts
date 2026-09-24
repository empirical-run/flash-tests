import { test, expect } from "./fixtures";
import { createSession, navigateToSessions, openReviewPanel, waitForAgentIdle } from "./pages/sessions";

test.describe('Impacted Tests Review', () => {
  test('create session, modify test, and verify impacted tests in review tab', async ({ page, trackCurrentSession }) => {
    await navigateToSessions(page);

    // Step 1: Create a new session with the message to modify login.spec.ts
    const message = "modify the test in tests/login.spec.ts to use user@example.com as the input email. make no other change. then commit and push the change.";
    await createSession(page, message);

    // Track the session for automatic cleanup
    trackCurrentSession(page);

    // Step 2: Wait for the committed edit rather than a transient read marker:
    // the agent may read via bash, and completed tool calls collapse into a
    // "Used N tools" group. Inspect the edit only after the turn is idle.
    const commitCard = page.getByRole('button', { name: /\bCommit created\b/i }).last();
    await expect(commitCard).toBeVisible({ timeout: 300000 });
    await waitForAgentIdle(page, 300000);
    const toolGroups = page.getByRole('button', { name: /^Used \d+ tools$/ });
    for (const group of await toolGroups.all()) {
      await group.click();
    }
    await expect(page.getByText(/^Used edit\b/i).first()).toBeVisible();

    // Step 3: The agent has finished committing and pushing the change.

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

    // Step 10: Assert that the test "click login button and input dummy email" is visible in the impacted tests list
    // Use getByTitle to uniquely target the list item span — its title attribute holds the full test name
    // (used for truncated text tooltip). The right panel detail view renders the same name as <h3> headings
    // which don't carry title attributes, so this locator uniquely resolves to the list item.
    await expect(reviewDialog.getByTitle("click login button and input dummy email")).toBeVisible();

    // Session will be automatically closed by afterEach hook
  });
});
