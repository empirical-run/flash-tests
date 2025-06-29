import { test, expect } from "./fixtures";
import { CliAuthPage } from "./pages/cli";

test.describe("CLI Authentication", () => {
  let cliAuthPage: CliAuthPage;

  test.beforeEach(async ({ page }) => {
    cliAuthPage = new CliAuthPage(page);
  });

  test.afterEach(async () => {
    await cliAuthPage.cleanup();
  });

  test("happy path authentication flow", async ({ page }) => {
    // Step 1: Start mock CLI callback server
    await cliAuthPage.startMockCliServer();

    // Step 2: Navigate to CLI auth page with redirect URI
    await cliAuthPage.navigateToCliAuth();

    // Step 3: Verify we're on the CLI auth page
    await expect(page).toHaveURL(/.*\/auth\/cli/);
    
    // Step 4: The page should show CLI authentication interface
    // (We'll need to identify the actual elements on the page)
    // TODO(agent on page): Verify CLI auth page loads and shows appropriate content for authenticated user

    // Step 5: Complete the authentication flow
    // The page should automatically redirect to the callback URL after processing
    // TODO(agent on page): Complete the CLI authentication flow (click authorize/confirm button if needed)

    // Step 6: Wait for callback to be received by mock server
    const callback = await cliAuthPage.waitForCallback(15000);

    // Step 7: Verify callback contains expected data
    expect(callback).toBeTruthy();
    expect(callback.code).toBeTruthy();
    expect(callback.code).toMatch(/^[a-zA-Z0-9_-]+$/); // Should be a valid code format
    expect(callback.error).toBeFalsy();

    // Step 8: Verify the callback was received properly
    const receivedCallback = cliAuthPage.getReceivedCallback();
    expect(receivedCallback).toEqual(callback);
    
    console.log('CLI Authentication completed successfully');
    console.log('Received callback:', callback);
  });
});