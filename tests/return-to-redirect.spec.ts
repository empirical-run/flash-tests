import { test, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

test.describe("ReturnTo Redirection", () => {
  let client: EmailClient;
  let userEmail: string;

  test.beforeEach(async () => {
    // Use a known email for login testing
    const emailId = `test-return-to-${Date.now()}`;
    client = new EmailClient({ emailId });
    userEmail = client.getAddress();
  });

  test("returnTo without query params is preserved", async ({ customContextPageProvider }) => {
    // Create a fresh browser context without authentication
    const { page } = await customContextPageProvider({ storageState: undefined });

    // Navigate to a protected page
    await page.goto("/lorem-ipsum/app-knowledge");

    // Should redirect to login with returnTo parameter
    await expect(page).toHaveURL(/\/login\?returnTo=%2Florem-ipsum%2Fapp-knowledge/);

    // Perform login via email
    await page.getByRole("button", { name: "Login with Email" }).click();
    await page.locator("#email-magic").fill(userEmail);
    await page.getByRole("button", { name: "Send Email" }).click();

    // Wait for and get the magic link email
    const email = await client.waitForEmail();
    const magicLink = email.links.find(
      (link) =>
        link.href.includes("/auth/") ||
        link.href.includes("/login") ||
        link.href.includes("/magic") ||
        link.href.includes("/verify"),
    );
    expect(magicLink).toBeTruthy();

    // Transform the magic link URL to use the correct base URL
    const baseUrl = process.env.BUILD_URL || "https://dash.empirical.run";
    const transformedMagicLinkUrl = magicLink!.href.replace(
      /^https?:\/\/localhost:\d+/,
      baseUrl,
    );

    // Navigate to the magic link and confirm login
    await page.goto(transformedMagicLinkUrl);
    await page.getByRole("button", { name: "Confirm Login" }).click();

    // After successful login, should be redirected to the original page
    await expect(page).toHaveURL(/\/lorem-ipsum\/app-knowledge/, { timeout: 15000 });
    
    // Verify we're on the app knowledge page
    await expect(page.getByRole("heading", { name: "App Knowledge" })).toBeVisible();
  });

  test("returnTo with query params is preserved", async ({ customContextPageProvider }) => {
    // Create a fresh browser context without authentication
    const { page } = await customContextPageProvider({ storageState: undefined });

    // Navigate to a protected page with query params
    await page.goto("/sessions?id=39626");

    // Should redirect to login with returnTo parameter including query params
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fsessions%3Fid%3D39626/);

    // Perform login via email
    await page.getByRole("button", { name: "Login with Email" }).click();
    await page.locator("#email-magic").fill(userEmail);
    await page.getByRole("button", { name: "Send Email" }).click();

    // Wait for and get the magic link email
    const email = await client.waitForEmail();
    const magicLink = email.links.find(
      (link) =>
        link.href.includes("/auth/") ||
        link.href.includes("/login") ||
        link.href.includes("/magic") ||
        link.href.includes("/verify"),
    );
    expect(magicLink).toBeTruthy();

    // Transform the magic link URL to use the correct base URL
    const baseUrl = process.env.BUILD_URL || "https://dash.empirical.run";
    const transformedMagicLinkUrl = magicLink!.href.replace(
      /^https?:\/\/localhost:\d+/,
      baseUrl,
    );

    // Navigate to the magic link and confirm login
    await page.goto(transformedMagicLinkUrl);
    await page.getByRole("button", { name: "Confirm Login" }).click();

    // After successful login, should be redirected to the original page with query params
    await expect(page).toHaveURL(/\/sessions\?id=39626/, { timeout: 15000 });
  });
});
