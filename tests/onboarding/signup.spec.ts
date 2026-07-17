import { test, expect } from "../fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";
import { getDashboardBaseUrl } from "../pages/urls";

test.describe("Signup with Magic Link", () => {
  test.describe.configure({ mode: "serial" });

  let client: EmailClient;
  let signupEmail: string;
  let confirmLinkUrl: string;

  test("can request magic link sign-up for a new email", async ({ page }) => {
    // Create a dynamic email for testing a brand new sign-up
    client = new EmailClient({ provider: "inbox" });
    signupEmail = client.getAddress();

    // Navigate directly to the sign-up page
    await page.goto("/signup");

    // Enter the new email address and continue
    await page.getByRole("textbox", { name: "Email" }).fill(signupEmail);
    await page.getByRole("button", { name: "Continue" }).click();

    // Choose the magic link option instead of setting a password
    await page.getByRole("button", { name: "Send magic link" }).click();

    // Assert that the success message is visible
    await expect(
      page.getByText("Check your email for a sign-in link"),
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
    await expect(
      page.getByRole("button", { name: signupEmail }),
    ).toBeVisible({ timeout: 15000 });

    // A brand new account has no sessions yet
    await expect(page.getByText("No sessions available").first()).toBeVisible();
  });
});
