import { test, expect } from "../fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";
import { getDashboardBaseUrl } from "../pages/urls";

const signupPassword = "TestPassword123!";

test.describe("Signup with Password", () => {
  test("signs up with a password, confirms email, and can log in", async ({
    page,
    context,
  }) => {
    // Create a dynamic email for a brand new sign-up. The client must be created
    // before the app sends the email so waitForEmail (which only picks up mail
    // received after creation) sees the confirmation message.
    const client = new EmailClient({ provider: "inbox" });
    const signupEmail = client.getAddress();

    // Sign up directly on the /signup page with email + password
    await page.goto("/signup");
    await page.getByRole("textbox", { name: "Email" }).fill(signupEmail);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("textbox", { name: "Password" }).fill(signupPassword);
    await page.getByRole("button", { name: "Create account" }).click();

    // The app tells the user to confirm via the email that was just sent
    await expect(
      page.getByText(
        `We sent a confirmation link to ${signupEmail}. Click the link in the email to finish creating your account.`,
      ),
    ).toBeVisible();

    // Fetch the confirmation email and extract the confirmation link
    const email = await client.waitForEmail();
    const confirmLink = email.links.find((link) =>
      link.href.includes("/magic-link-landing"),
    );
    expect(confirmLink).toBeTruthy();

    // Transform the link to the correct base URL for the test environment
    const baseUrl = getDashboardBaseUrl();
    const transformedConfirmUrl = confirmLink!.href.replace(
      /^https?:\/\/localhost:\d+/,
      baseUrl,
    );

    // Confirm the sign-up and assert the new user lands in the dashboard
    await page.goto(transformedConfirmUrl);
    await page.getByRole("button", { name: "Confirm Signup" }).click();
    await expect(page.getByRole("button", { name: signupEmail })).toBeVisible({
      timeout: 15000,
    });
    // A brand new account has no sessions yet
    await expect(page.getByText("No sessions available").first()).toBeVisible();

    // Open profile settings and assert the confirmed email shows as verified
    await page.getByRole("button", { name: signupEmail }).click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings\/profile$/);
    await expect(page.getByText("Email verified")).toBeVisible();
    await expect(page.getByText("Verified", { exact: true })).toBeVisible();

    // Sign out (clear the session) and verify the password set during sign-up works
    await context.clearCookies();
    await page.goto("/login");
    await page.getByRole("textbox", { name: /email/i }).fill(signupEmail);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("textbox", { name: "Password" }).fill(signupPassword);
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByRole("button", { name: signupEmail })).toBeVisible({
      timeout: 15000,
    });
  });

  test("cannot log in before confirming the email", async ({ page }) => {
    // Create a new account but do NOT confirm the email
    const client = new EmailClient({ provider: "inbox" });
    const signupEmail = client.getAddress();

    await page.goto("/signup");
    await page.getByRole("textbox", { name: "Email" }).fill(signupEmail);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("textbox", { name: "Password" }).fill(signupPassword);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(
      page.getByText(
        `We sent a confirmation link to ${signupEmail}. Click the link in the email to finish creating your account.`,
      ),
    ).toBeVisible();

    // Attempt to log in with the correct password before confirming the email
    await page.goto("/login");
    await page.getByRole("textbox", { name: /email/i }).fill(signupEmail);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("textbox", { name: "Password" }).fill(signupPassword);
    await page.getByRole("button", { name: "Submit" }).click();

    // Login is blocked with an "email not confirmed" message
    await expect(
      page.getByText(
        "Your email is not confirmed yet. Check your inbox for the confirmation link, or resend it below.",
      ),
    ).toBeVisible();

    // A resend affordance is offered so the user can request another link
    await expect(
      page.getByRole("button", { name: "Resend confirmation email" }),
    ).toBeVisible();
  });
});
