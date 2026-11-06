import { join } from "path";
import { expect, Page } from "@playwright/test";
import type { CommandEnv } from "../lib/command";
import { loginWithPassword } from "./login";
import { getDashboardBaseUrl } from "./urls";

export const CLI_ENVIRONMENT =
  process.env.EMPIRICAL_CLI_AUTH_ENV ??
  (process.env.TEST_RUN_ENVIRONMENT === "preview" ? "staging" : "prod");
export const CLI_ENVIRONMENTS = ["prod", "staging", "local"];

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
    EMPIRICAL_DASHBOARD_URL: getDashboardBaseUrl(),
    // Exercise real CLI OAuth rather than the agent sandbox's authenticated API
    // proxy, which deliberately bypasses `empirical login` when inherited.
    EMPIRICAL_API_URL: undefined,
  };
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
    const redirectUrl = new URL(location);
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
