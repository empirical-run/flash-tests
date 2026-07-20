import { test, expect } from "../fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";
import { getDashboardBaseUrl } from "../pages/urls";

const signupPassword = "TestPassword123!";

test("explore profile", async ({ page }) => {
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

  const email = await client.waitForEmail();
  const confirmLink = email.links.find((link) =>
    link.href.includes("/magic-link-landing"),
  );
  const baseUrl = getDashboardBaseUrl();
  const transformedConfirmUrl = confirmLink!.href.replace(
    /^https?:\/\/localhost:\d+/,
    baseUrl,
  );
  await page.goto(transformedConfirmUrl);
  await page.getByRole("button", { name: "Confirm Signup" }).click();
  await expect(page.getByRole("button", { name: signupEmail })).toBeVisible({
    timeout: 15000,
  });

  // Try to open profile settings
  await page.getByRole("button", { name: signupEmail }).click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await page.waitForTimeout(1500);
  console.log("URL after settings click:", page.url());
  console.log("=== SETTINGS BODY ===");
  console.log(await page.locator("body").innerText());
  await page.screenshot({ path: "/tmp/settings.png", fullPage: true });
});
