import { test, expect } from "./fixtures";
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
  await expect(page.getByRole("link", { name: "Settings", exact: true })).toBeVisible();
});

test("new empty test", async ({ page }) => {
  await page.goto("https://v0-button-to-open-v0-home-page-h5dizpkwp.vercel.app/");
  
  // Click on the button which opens a new tab/popup
  const page1Promise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Click me' }).click();
  const page1 = await page1Promise;
});
