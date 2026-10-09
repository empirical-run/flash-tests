import { Page } from "@playwright/test";
import { generateToken } from "authenticator";
import { setTimeout as wait } from "node:timers/promises";
import { completeTotpChallenge } from "./google-totp-policy";
import { getDashboardBaseUrl } from "./urls";

/** Real Google OAuth + authenticator challenge, with bounded OTP-only recovery. */
export async function loginToGoogle(
  page: Page,
  credentials: { email: string; password: string; authKey: string },
): Promise<void> {
  // Keep the existing Google identifier/password pacing. The maintenance change
  // is limited to the authenticator phase, not CAPTCHA or other auth failures.
  await page.waitForTimeout(5_000);
  await page.getByLabel("Email or phone").click();
  await page.getByLabel("Email or phone").fill(credentials.email);
  await page.waitForTimeout(5_000);
  await page.getByLabel("Email or phone").press("Enter");
  await page.getByLabel("Enter your password").click();
  await page.getByLabel("Enter your password").fill(credentials.password);
  await page.waitForTimeout(5_000);
  await page.getByRole("button", { name: "Next" }).click();
  await page.waitForTimeout(5_000);

  const input = page.getByLabel("Enter code");
  const next = page.getByRole("button", { name: "Next" });
  const callbackOrigin = new URL(getDashboardBaseUrl()).origin;
  await completeTotpChallenge({
    now: Date.now,
    wait,
    prepare: async () => {
      await input.waitFor({ state: "visible" });
      await next.waitFor({ state: "visible" });
      await input.click();
    },
    submit: async () => {
      // Generate only after locator readiness and the clock-window gate. Never
      // log the key/code or sleep between code generation and submission.
      await input.fill(generateToken(credentials.authKey));
      await next.click();
    },
    outcome: async (submission) => {
      // On the last submission require the real callback, not a stale rejection
      // banner left over from submission one. No additional retry is allowed.
      if (submission === 1) {
        await page.waitForURL((url) => url.origin === callbackOrigin, {
          timeout: 30_000,
        });
        return "callback";
      }
      // Arbitrary auth, CAPTCHA, callback and app failures time out normally;
      // only the actual Google authenticator rejection permits recovery.
      await page.waitForFunction(
        (origin) =>
          location.origin === origin ||
          (location.hostname === "accounts.google.com" &&
            location.pathname.includes("/challenge/totp") &&
            document.body.innerText.includes("Wrong code. Try again.")),
        callbackOrigin,
        { timeout: 30_000 },
      );
      return new URL(page.url()).origin === callbackOrigin
        ? "callback"
        : "wrong-code";
    },
  });
}
