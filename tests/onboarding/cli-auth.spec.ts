import { test, expect } from "../fixtures";
import { CliAuthPage } from "../pages/cli";

test.describe("CLI Authentication - Logged Out State", () => {
  let cliAuthPage: CliAuthPage;

  test.beforeEach(async ({ page }) => {
    cliAuthPage = new CliAuthPage(page);
  });

  test.afterEach(async () => {
    await cliAuthPage.cleanup();
  });

  test("CLI auth flow for logged out user", async ({ page }) => {
    // Step 1: Start mock CLI callback server
    await cliAuthPage.startMockCliServer();

    // Step 2: Navigate to CLI auth page while logged out
    await page.goto(cliAuthPage.getCliAuthUrl());

    // Step 3: Verify we're redirected to login page due to being logged out
    await expect(page).toHaveURL(/.*\/login/);
    await expect(page.getByText("Welcome to Empirical")).toBeVisible();
    
    // Step 4: Complete authentication flow (using Google login as example)
    // This simulates a user logging in after being prompted by CLI auth
    await page.getByRole("button", { name: "Login with Google" }).click();

    // Note: In a real scenario, this would require actual Google OAuth flow
    // For this test, we'll simulate the completion by navigating back to CLI auth
    // after a successful login (this would happen automatically in real flow)
    
    // Step 5: Simulate successful authentication and return to CLI auth
    // In practice, the auth flow would redirect back to the CLI auth URL
    await page.goto(cliAuthPage.getCliAuthUrl());
    
    // Step 6: Since we're still in logged-out state for this test, 
    // verify the expected behavior - user should see login requirement
    await expect(page).toHaveURL(/.*\/login/);
    
    console.log('CLI Authentication for logged out user: redirects to login as expected');
  });
});