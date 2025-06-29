import { test, expect } from "../fixtures";
import { CliAuthPage } from "../pages/cli";
import { loginToGoogle } from "@empiricalrun/playwright-utils";

test.describe("CLI Authentication - Logged Out State", () => {
  let cliAuthPage: CliAuthPage;

  test.beforeEach(async ({ page }) => {
    cliAuthPage = new CliAuthPage(page);
  });

  test.afterEach(async () => {
    await cliAuthPage.cleanup();
  });

  test("CLI auth redirects logged out user to login page", async ({ page }) => {
    // Step 1: Start mock CLI callback server
    await cliAuthPage.startMockCliServer();

    // Step 2: Navigate to CLI auth page while logged out
    await page.goto(cliAuthPage.getCliAuthUrl());

    // Step 3: Verify we're redirected to login page due to being logged out
    await expect(page).toHaveURL(/.*\/login/);
    await expect(page.getByText("Welcome to Empirical")).toBeVisible();
    
    // Step 4: Verify login options are available
    await expect(page.getByRole("button", { name: "Login with Google" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Login with Email" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Login with password" })).toBeVisible();
    
    console.log('CLI Authentication for logged out user: correctly redirects to login page');
  });

  test("complete CLI auth flow after login", async ({ page }) => {
    // Step 1: Start mock CLI callback server
    await cliAuthPage.startMockCliServer();

    // Step 2: Navigate to CLI auth page while logged out (should redirect to login)
    await page.goto(cliAuthPage.getCliAuthUrl());
    
    // Step 3: Verify we're on login page
    await expect(page).toHaveURL(/.*\/login/);
    
    // Step 4: Complete Google login flow
    await page.getByRole("button", { name: "Login with Google" }).click();
    
    await loginToGoogle(page, {
      email: process.env.GOOGLE_LOGIN_EMAIL!,
      password: process.env.GOOGLE_LOGIN_PASSWORD!,
      authKey: process.env.GOOGLE_LOGIN_AUTH_KEY!,
    });

    // Step 5: After successful login, we should be redirected back to CLI auth
    // Wait for CLI auth page to load and complete
    await expect(page).toHaveURL(/.*\/auth\/cli/);
    
    // Step 6: Verify CLI authentication completed successfully
    await expect(page.getByText("Authentication Complete")).toBeVisible();
    await expect(page.getByText("Authentication successful! Redirecting to CLI...")).toBeVisible();
    
    // Step 7: Verify success message details
    await expect(page.getByText("Successfully authenticated with your Empirical account")).toBeVisible();
    await expect(page.getByText("You can now close this window")).toBeVisible();

    // Step 8: Wait for callback to be received by mock server
    const callback = await cliAuthPage.waitForCallback(15000);

    // Step 9: Verify callback contains expected data
    expect(callback).toBeTruthy();
    expect(callback.code).toBeTruthy();
    expect(callback.code).toMatch(/^[a-zA-Z0-9_-]+$/); // Should be a valid code format
    expect(callback.error).toBeFalsy();

    // Step 10: Verify the callback was received properly
    const receivedCallback = cliAuthPage.getReceivedCallback();
    expect(receivedCallback).toEqual(callback);
    
    console.log('Complete CLI Authentication flow for logged out user completed successfully');
    console.log('Received callback:', callback);
  });
});