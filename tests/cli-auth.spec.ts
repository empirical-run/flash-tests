import { test, expect } from "./fixtures";
import {
  createCliAuthState,
  startMockCliServer,
  getCliAuthUrl,
  waitForCallback,
  getReceivedCallback,
  cleanupCliAuth,
  type CliAuthServerState,
} from "./pages/cli";

test.describe("CLI Authentication", () => {
  let cliAuthState: CliAuthServerState;

  test.beforeEach(async () => {
    cliAuthState = createCliAuthState();
  });

  test.afterEach(async () => {
    await cleanupCliAuth(cliAuthState);
  });

  test("CLI authentication flow", async ({ page }) => {
    // Step 1: Start mock CLI callback server
    await startMockCliServer(cliAuthState);

    // Step 2: Navigate to CLI auth page with redirect URI
    await page.goto(getCliAuthUrl(cliAuthState));

    // Step 3: Verify we're on the CLI auth page
    await expect(page).toHaveURL(/.*\/auth\/cli/);
    
    // Step 4: Verify CLI authentication completed successfully
    await expect(page.getByText("Authentication Complete")).toBeVisible();
    await expect(page.getByText("Authentication successful! Redirecting to CLI...")).toBeVisible();
    
    // Step 5: Verify success message details
    await expect(page.getByText("Successfully authenticated with your Empirical account")).toBeVisible();
    await expect(page.getByText("You can now close this window")).toBeVisible();

    // Step 6: Wait for callback to be received by mock server
    const callback = await waitForCallback(cliAuthState, 15000);

    // Step 7: Verify callback contains expected data
    expect(callback).toBeTruthy();
    expect(callback.code).toBeTruthy();
    expect(callback.code).toMatch(/^[a-zA-Z0-9_-]+$/); // Should be a valid code format
    expect(callback.error).toBeFalsy();

    // Step 8: Verify the callback was received properly
    const receivedCallback = getReceivedCallback(cliAuthState);
    expect(receivedCallback).toEqual(callback);
    
    console.log('CLI Authentication completed successfully');
    console.log('Received callback:', callback);
  });
});