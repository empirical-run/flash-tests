import { test, expect } from "../fixtures";
import { EmailClient, loginToGoogle } from "@empiricalrun/playwright-utils";

test.describe("Magic Link Login", () => {
  test.describe.configure({ mode: "serial" });

  let client: EmailClient;
  let unregisteredEmail: string;
  let magicLinkUrl: string;

  test("can request magic link for unregistered email", async ({ page }) => {
    // Create a dynamic email for testing unregistered user scenario
    client = new EmailClient();
    unregisteredEmail = client.getAddress();

    // Navigate to the app
    await page.goto("/");

    // Click on magic link login option
    await page.getByRole("button", { name: "Login with Email" }).click();

    // Enter the unregistered email address
    await page.locator("#email-magic").fill(unregisteredEmail);
    await page.getByRole("button", { name: "Send Email" }).click();

    // Assert that the success message is visible
    await expect(
      page.getByText("Check your email for a sign-in link"),
    ).toBeVisible();
  });

  test("receives magic link email for unregistered user", async ({}) => {
    // Wait for the magic link email
    const email = await client.waitForEmail();

    // Verify email was received
    expect(email).toBeTruthy();

    // Find the magic link in the email
    const magicLink = email.links.find(
      (link) =>
        link.href.includes("/auth/") ||
        link.href.includes("/login") ||
        link.href.includes("/magic") ||
        link.href.includes("/verify") ||
        link.text?.toLowerCase().includes("sign") ||
        link.text?.toLowerCase().includes("login"),
    );

    expect(magicLink).toBeTruthy();
    magicLinkUrl = magicLink!.href;
  });

  test("shows appropriate message when unregistered user clicks magic link", async ({
    page,
  }) => {
    // Transform the magic link URL to use the correct base URL for the test environment
    // The email contains localhost URLs but we need to use the actual deployment URL
    const baseUrl = process.env.BUILD_URL || "https://dash.empirical.run";
    const transformedMagicLinkUrl = magicLinkUrl.replace(
      /^https?:\/\/localhost:\d+/,
      baseUrl,
    );

    // Navigate to the magic link
    await page.goto(transformedMagicLinkUrl);

    // Click the Confirm Login button
    await page.getByRole("button", { name: "Confirm Login" }).click();

    // Assert that the user sees the message about unregistered domain
    await expect(
      page.getByText(
        "Your email domain is not registered with Empirical. Contact us to onboard your team.",
      ),
    ).toBeVisible();

    // Also verify we're on the login page with the unregistered domain status
    await expect(page).toHaveURL(/.*status=unregistered_domain/);
  });
});

test("google login", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Login with Google" }).click();

  // On the google login page
  await loginToGoogle(page, {
    email: process.env.GOOGLE_LOGIN_EMAIL!,
    password: process.env.GOOGLE_LOGIN_PASSWORD!,
    authKey: process.env.GOOGLE_LOGIN_AUTH_KEY!,
  });

  // Assert successful login
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible({ timeout: 30000 });
});

test("google login fails with expired auth token cookie", async ({ page, customContextPageProvider }) => {
  // Create a new empty browser context without any auth state
  const { page: cleanPage, context } = await customContextPageProvider({ storageState: undefined });

  // Determine the Supabase project ID based on environment
  const supabaseProjectId = process.env.TEST_RUN_ENVIRONMENT === 'preview' 
    ? 'ulpuyzcqwbrtbnqqpooa' 
    : 'chzthcylyhkimffjikjy';

  // Add the expired auth token cookie manually
  await context.addCookies([{
    name: `sb-${supabaseProjectId}-auth-token`,
    value: '{"access_token":"expired_token","refresh_token":"invalid_refresh","expires_at":1609459200}',
    domain: new URL(process.env.BUILD_URL || "https://dash.empirical.run").hostname,
    path: "/",
  }]);

  // Navigate to the app
  await cleanPage.goto("/");

  // Try to login with Google
  await cleanPage.getByRole("button", { name: "Login with Google" }).click();

  // Complete the Google login flow
  await loginToGoogle(cleanPage, {
    email: process.env.GOOGLE_LOGIN_EMAIL!,
    password: process.env.GOOGLE_LOGIN_PASSWORD!,
    authKey: process.env.GOOGLE_LOGIN_AUTH_KEY!,
  });

  // Wait for redirect back to the app
  const baseUrl = process.env.BUILD_URL || "https://dash.empirical.run";
  const urlPattern = baseUrl.replace(/\./g, '\\.').replace(/:/g, '\\:');
  await expect(cleanPage).toHaveURL(new RegExp(`^${urlPattern}`), { timeout: 30000 });

  // Assert that login fails with "session expired" error
  await expect(cleanPage.getByText("Your session expired. Please try logging in again.")).toBeVisible({ timeout: 15000 });

  // Now try logging in again with Google - this time it should succeed
  // Since the browser context already has an authenticated Google session,
  // Google will auto-authenticate without showing the login form
  await cleanPage.getByRole("button", { name: "Login with Google" }).click();

  // Assert successful login this time
  await expect(cleanPage.getByRole("button", { name: "Settings", exact: true })).toBeVisible({ timeout: 30000 });
});