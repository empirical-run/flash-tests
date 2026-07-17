import { test, expect } from "../fixtures";
import { EmailClient, loginToGoogle } from "@empiricalrun/playwright-utils";
import { getDashboardBaseUrl } from "../pages/urls";

test.describe("Magic Link Login", () => {
  test.describe.configure({ mode: "serial" });

  let client: EmailClient;
  let unregisteredEmail: string;
  let magicLinkUrl: string;
  let returnToCookie: { name: string; value: string; domain: string; path: string; } | undefined;
  let authCookies: Array<{ name: string; value: string; domain: string; path: string }> = [];

  test("can request magic link for unregistered email", async ({ page, context }) => {
    // Create a dynamic email for testing unregistered user scenario
    client = new EmailClient({ provider: "inbox" });
    unregisteredEmail = client.getAddress();

    // Navigate to a protected page (test run detail page)
    // Use different test run IDs based on environment
    const testRunId = process.env.TEST_RUN_ENVIRONMENT === 'preview' ? '4538' : '39536';
    await page.goto(`/lorem-ipsum/test-runs/${testRunId}`);

    // Enter the unregistered email address and request magic link
    await page.getByRole('textbox', { name: /email/i }).fill(unregisteredEmail);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Send magic link' }).click();

    // Assert that the success message is visible
    await expect(
      page.getByText("Check your email for a sign-in link"),
    ).toBeVisible();

    // Assert that the returnTo cookie is set correctly
    const cookies = await context.cookies();
    const returnToCookieFound = cookies.find(c => c.name === "returnTo");
    expect(returnToCookieFound).toBeTruthy();
    // The cookie value is URL-encoded, so decode it for comparison
    expect(decodeURIComponent(returnToCookieFound?.value || "")).toBe(`/lorem-ipsum/test-runs/${testRunId}`);
    
    // Save the cookie for test 3
    if (returnToCookieFound) {
      returnToCookie = {
        name: returnToCookieFound.name,
        value: returnToCookieFound.value,
        domain: returnToCookieFound.domain,
        path: returnToCookieFound.path,
      };
    }
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

  test("user logs in successfully and redirects to original page", async ({
    page,
    context,
  }) => {
    // Restore the returnTo cookie from test 1
    if (returnToCookie) {
      await context.addCookies([returnToCookie]);
    }

    // Transform the magic link URL to use the correct base URL for the test environment
    // The email contains localhost URLs but we need to use the actual deployment URL
    const baseUrl = getDashboardBaseUrl();
    const transformedMagicLinkUrl = magicLinkUrl.replace(
      /^https?:\/\/localhost:\d+/,
      baseUrl,
    );

    // Navigate to the magic link
    await page.goto(transformedMagicLinkUrl);

    // Click the confirmation button. For an unregistered email this is a signup
    // flow, so the app labels it "Confirm Signup"; registered users see "Confirm Login".
    await page.getByRole("button", { name: /Confirm (Login|Signup)/ }).click();

    // Assert that the user is successfully logged in and can see the project switcher.
    // In the new layout this control lives in the header rather than inside a navigation landmark.
    await expect(page.getByRole('button', { name: /Lorem Ipsum/ })).toBeVisible({ timeout: 15000 });

    // Use different test run IDs based on environment
    const testRunId = process.env.TEST_RUN_ENVIRONMENT === 'preview' ? '4538' : '39536';

    // Verify we're redirected back to the test run page we originally tried to access
    await expect(page).toHaveURL(new RegExp(`/lorem-ipsum/test-runs/${testRunId}`));

    // Verify the test run data is displayed - check for "Failed" status badge
    await expect(page.getByText("Failed").first()).toBeVisible();

    // Save auth cookies so the next test can reuse the session.
    // Capture the full cookie objects so expires, httpOnly, secure and sameSite are preserved.
    authCookies = await context.cookies();
  });

  test("can search for members in Team settings as newly signed up user", async ({ page, context }) => {
    // Restore auth cookies from the magic link login
    await context.addCookies(authCookies);

    // Navigate directly to Team settings
    await page.goto('/lorem-ipsum/settings/team');

    // Wait for the member list to load — the search box only appears after data loads
    const searchBox = page.getByRole('textbox', { name: 'Search members' });
    await searchBox.waitFor();

    // automation-test@example.com is a stable fixture — confirms the list loaded correctly
    await expect(page.getByText('automation-test@example.com').first()).toBeVisible();

    // The truncation hint is visible when the list exceeds the display limit (unfiltered state)
    await expect(page.getByText('Use search to narrow the list')).toBeVisible();

    // Search for "automation-test" to filter the list
    await searchBox.fill('automation-test');

    // automation-test@example.com should appear in search results
    await expect(page.getByText('automation-test@example.com').first()).toBeVisible();

    // Truncation hint disappears once the list is filtered down to a small result set
    await expect(page.getByText('Use search to narrow the list')).not.toBeVisible();

    // Search for the newly signed up user's own email — it should appear in results
    await searchBox.fill(unregisteredEmail);
    await expect(page.getByText(unregisteredEmail).first()).toBeVisible();
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

  // Assert successful login by checking for the authenticated dashboard shell.
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 30000 });
});

test.skip("google login fails with expired auth token cookie", async ({ page, customContextPageProvider }) => {
  // Close the unused default page
  await page.close();
  
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
    domain: new URL(getDashboardBaseUrl()).hostname,
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
  const baseUrl = getDashboardBaseUrl();
  const urlPattern = baseUrl.replace(/\./g, '\\.').replace(/:/g, '\\:');
  await expect(cleanPage).toHaveURL(new RegExp(`^${urlPattern}`), { timeout: 30000 });

  // Assert that login fails with "session expired" error
  await expect(cleanPage.getByText("Your session expired. Please try logging in again.")).toBeVisible({ timeout: 15000 });

  // Assert that the expired auth cookie has been deleted
  const cookies = await context.cookies();
  const authCookie = cookies.find(c => c.name === `sb-${supabaseProjectId}-auth-token`);
  expect(authCookie).toBeUndefined();

  // Now try logging in again with Google - this time it should succeed
  // Since the browser context already has an authenticated Google session,
  // Google will auto-authenticate without showing the login form
  await cleanPage.getByRole("button", { name: "Login with Google" }).click();

  // Assert successful login this time by checking for the authenticated dashboard shell.
  await expect(cleanPage.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 30000 });
});