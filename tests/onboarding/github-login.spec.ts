import { test, expect } from "../fixtures";
import authenticator from "authenticator";

test("sign in to GitHub with 2FA authenticator", async ({ page }) => {
  const username = process.env.GITHUB_USERNAME!;
  const password = process.env.GITHUB_PASSWORD!;
  const authKey = process.env.GITHUB_AUTH_KEY!;

  // Navigate to GitHub login page
  await page.goto("https://github.com/login");

  // Fill in username/email
  await page.getByLabel("Username or email address").fill(username);

  // Fill in password
  await page.getByLabel("Password").fill(password);

  // Submit the login form
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  // Generate TOTP token and enter it on the 2FA page
  const formattedToken = authenticator.generateToken(authKey);
  await page.getByRole("textbox").fill(formattedToken);

  // Assert successful sign-in: GitHub redirects to the dashboard/home page
  await expect(page).toHaveURL(/github\.com(?!\/login)/, { timeout: 15000 });
  await expect(page.getByRole("navigation").getByLabel("Homepage")).toBeVisible();
});
