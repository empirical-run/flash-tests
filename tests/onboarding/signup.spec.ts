import { test, expect } from "../fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";
import { getDashboardBaseUrl } from "../pages/urls";

test.describe("Signup with Password", () => {
  test.describe.configure({ mode: "serial" });

  const signupPassword = "TestPassword123!";
  let client: EmailClient;
  let signupEmail: string;
  let confirmLinkUrl: string;

  test("can create an account with email and password", async ({ page }) => {
    // Create a dynamic email for testing a brand new sign-up.
    // The client must be created before the app sends the email so that
    // waitForEmail (which only picks up mails received after creation) sees it.
    client = new EmailClient({ provider: "inbox" });
    signupEmail = client.getAddress();

    // Navigate directly to the sign-up page
    await page.goto("/signup");

    // Enter the new email address and continue
    await page.getByRole("textbox", { name: "Email" }).fill(signupEmail);
    await page.getByRole("button", { name: "Continue" }).click();

    // Set a password and create the account
    await page.getByRole("textbox", { name: "Password" }).fill(signupPassword);
    await page.getByRole("button", { name: "Create account" }).click();

    // Assert the confirmation screen tells the user to check their email
    await expect(
      page.getByText(
        `We sent a confirmation link to ${signupEmail}. Click the link in the email to finish creating your account.`,
      ),
    ).toBeVisible();
  });

  test("receives sign-up confirmation email", async ({}) => {
    // Wait for the sign-up confirmation email
    const email = await client.waitForEmail();

    // Verify email was received
    expect(email).toBeTruthy();

    // Find the confirmation link in the email
    const confirmLink = email.links.find((link) =>
      link.href.includes("/magic-link-landing"),
    );

    expect(confirmLink).toBeTruthy();
    confirmLinkUrl = confirmLink!.href;
  });

  test("confirms sign-up and lands in the dashboard as the new user", async ({
    page,
  }) => {
    // Transform the confirmation URL to use the correct base URL for the test environment
    const baseUrl = getDashboardBaseUrl();
    const transformedConfirmUrl = confirmLinkUrl.replace(
      /^https?:\/\/localhost:\d+/,
      baseUrl,
    );

    // Navigate to the confirmation link
    await page.goto(transformedConfirmUrl);

    // Complete the final sign-up step
    await page.getByRole("button", { name: "Confirm Signup" }).click();

    // Assert that the user is signed in - the header shows the new user's email
    await expect(page.getByRole("button", { name: signupEmail })).toBeVisible({
      timeout: 15000,
    });

    // A brand new account has no sessions yet
    await expect(page.getByText("No sessions available").first()).toBeVisible();
  });

  test("can log in with the password set during sign-up", async ({ page }) => {
    // This test starts with a fresh, unauthenticated context (onboarding project),
    // so we can verify the password created during sign-up actually works.
    await page.goto("/login");

    // Log in using the email + password from the sign-up flow
    await page.getByRole("textbox", { name: /email/i }).fill(signupEmail);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("textbox", { name: "Password" }).fill(signupPassword);
    await page.getByRole("button", { name: "Submit" }).click();

    // Assert that the user is signed in - the header shows their email
    await expect(page.getByRole("button", { name: signupEmail })).toBeVisible({
      timeout: 15000,
    });
  });
});
