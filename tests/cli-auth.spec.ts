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

  test("CLI authentication flow", async ({ page }) => {
    // Step 1: Start mock CLI callback server
    await cliAuthPage.startMockCliServer();

    // Step 2: Navigate to CLI auth page with redirect URI
    await page.goto(cliAuthPage.getCliAuthUrl());

    // Step 3: Verify we're on the CLI auth page
    await expect(page).toHaveURL(/.*\/auth\/cli/);
    
    // Step 4: Verify CLI authentication completed successfully
    await expect(page.getByText("Authentication Complete")).toBeVisible();
    await expect(page.getByText("Authentication successful! Redirecting to CLI...")).toBeVisible();
    
    // Step 5: Verify success message details
    // TODO(agent on page): Check what the actual success message text is on this page
    await expect(page.getByText("You can now close this window")).toBeVisible();

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