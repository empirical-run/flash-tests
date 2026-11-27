import { join } from "path";
import { expect, Page } from "@playwright/test";
import type { CommandEnv, RunningCommand } from "../lib/command";
import { escapeRegExp } from "../lib/regex";
import { loginWithPassword } from "./login";
import { getDashboardBaseUrl, isPreviewEnvironment } from "./urls";

export const CLI_ENVIRONMENT =
  process.env.EMPIRICAL_CLI_AUTH_ENV ??
  (isPreviewEnvironment() ? "staging" : "prod");
export const CLI_ENVIRONMENTS = ["prod", "staging", "local"];

// Preview builds use staging Supabase, whose OAuth consent URL points at
// localhost:3000. With EMPIRICAL_DASHBOARD_URL set, `empirical login` and
// `empirical signup` open the consent page on that dashboard origin instead.
// Production leaves it unset so the CLI keeps its default Supabase authorize URL.
export const CLI_USES_DASHBOARD_CONSENT = isPreviewEnvironment();

export function cliEnv(home: string, localBinOnPath = true): CommandEnv {
  if (!CLI_ENVIRONMENTS.includes(CLI_ENVIRONMENT)) {
    throw new Error("EMPIRICAL_CLI_AUTH_ENV must be prod, staging, or local");
  }

  const path = localBinOnPath
    ? `${join(home, ".local", "bin")}:${process.env.PATH ?? ""}`
    : process.env.PATH;

  return {
    ...process.env,
    HOME: home,
    PATH: path,
    CI: "true",
    EMPIRICAL_CONFIGURE_SKILL: "no",
    EMPIRICAL_ENV: CLI_ENVIRONMENT,
    EMPIRICAL_DASHBOARD_URL: CLI_USES_DASHBOARD_CONSENT
      ? getDashboardBaseUrl()
      : undefined,
    // Exercise real CLI OAuth rather than the agent sandbox's authenticated API
    // proxy, which deliberately bypasses `empirical login` when inherited.
    EMPIRICAL_API_URL: undefined,
  };
}

/**
 * Waits for the URL `empirical login` opens. Production prints the Supabase
 * authorize URL (PKCE, localhost callback). Preview sets EMPIRICAL_DASHBOARD_URL
 * (see cliEnv), so the CLI prints the consent page on the BUILD_URL origin.
 */
export async function waitForLoginAuthorizationUrl(
  loginCommand: RunningCommand,
  timeoutMs: number,
): Promise<string> {
  if (CLI_USES_DASHBOARD_CONSENT) {
    const consentUrlMatch = await loginCommand.waitForOutput(
      new RegExp(
        `${escapeRegExp(getDashboardBaseUrl())}/oauth/consent\\?authorization_id=\\S+`,
      ),
      timeoutMs,
    );
    const consentUrl = new URL(consentUrlMatch[0]);
    expect(consentUrl.origin).toBe(new URL(getDashboardBaseUrl()).origin);
    expect(consentUrl.pathname).toBe("/oauth/consent");
    expect(consentUrl.searchParams.get("authorization_id")).toMatch(/^\w+$/);
    return consentUrlMatch[0];
  }

  const loginUrlMatch = await loginCommand.waitForOutput(
    /https?:\/\/\S*\/auth\/v1\/oauth\/authorize\S*/,
    timeoutMs,
  );
  const parsedAuthorizationUrl = new URL(loginUrlMatch[0]);
  expect(parsedAuthorizationUrl.pathname).toContain("/auth/v1/oauth/authorize");
  expect(parsedAuthorizationUrl.searchParams.get("response_type")).toBe("code");
  expect(parsedAuthorizationUrl.searchParams.get("code_challenge_method")).toBe(
    "S256",
  );
  expect(parsedAuthorizationUrl.searchParams.get("redirect_uri")).toBe(
    "http://127.0.0.1:14538/oauth/callback",
  );
  return loginUrlMatch[0];
}

export async function resolveAuthorizationUrlForBrowser(
  page: Page,
  authorizationUrl: string,
) {
  const authorizationResponse = await page.request.get(authorizationUrl, {
    maxRedirects: 0,
  });
  const location = authorizationResponse.headers().location;

  if (location) {
    const redirectUrl = new URL(location, authorizationUrl);
    if (redirectUrl.hostname === "localhost" && redirectUrl.port === "3000") {
      const buildUrl = new URL(getDashboardBaseUrl());
      redirectUrl.protocol = buildUrl.protocol;
      redirectUrl.hostname = buildUrl.hostname;
      redirectUrl.port = buildUrl.port;
    }
    return redirectUrl.toString();
  }

  return authorizationUrl;
}

export async function expectCliAuthorized(page: Page) {
  // The CLI still receives the code on localhost, then redirects the browser to
  // the hosted success page. Terminal exit and whoami below verify token exchange.
  await expect(page).toHaveURL(
    `${getDashboardBaseUrl()}/oauth/cli-callback?status=authorized`,
  );
  await expect(
    page.getByText("Empirical CLI authorized", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("You can close this tab and return to your terminal."),
  ).toBeVisible();
}

export async function signInAndAuthorizeCli(
  page: Page,
  authorizationUrl: string,
) {
  await page.goto(
    await resolveAuthorizationUrlForBrowser(page, authorizationUrl),
  );

  // Logged out, the dashboard consent page sends the user to log in first and
  // comes back to the same consent request afterwards.
  await expect(page).toHaveURL(
    new RegExp(
      `^${escapeRegExp(getDashboardBaseUrl())}/login\\?returnTo=${escapeRegExp(encodeURIComponent("/oauth/consent?authorization_id="))}`,
    ),
  );
  await loginWithPassword(page);

  const authorizeButton = page.getByRole("button", { name: "Authorize" });
  const authorizedHeading = page.getByText("Empirical CLI authorized");

  // The automated account may have already authorized this OAuth client. In that
  // case the app redirects directly to the CLI callback page without showing the
  // consent form again.
  await expect(authorizeButton.or(authorizedHeading)).toBeVisible();
  if (await authorizeButton.isVisible()) {
    await expect(
      page.getByRole("heading", { name: "Authorize Application" }),
    ).toBeVisible();
    await authorizeButton.click();
  }

  await expectCliAuthorized(page);
}
