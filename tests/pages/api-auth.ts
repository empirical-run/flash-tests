import { expect, Page } from "@playwright/test";

/**
 * Builds authenticated API headers from the current browser session.
 *
 * This is used by tests/helpers that call the production/preview API directly
 * instead of same-origin dashboard endpoints.
 *
 * @param page The Playwright page object with an authenticated context
 * @returns Authorization, content-type, and project-id headers
 */
export async function getApiWorkerAuthHeaders(
  page: Page,
): Promise<Record<string, string>> {
  const cookies = await page.context().cookies();
  const authTokenCookies = cookies
    .filter((cookie) => cookie.name.includes("auth-token"))
    .sort((a, b) => a.name.localeCompare(b.name));

  expect(authTokenCookies.length).toBeGreaterThan(0);

  const rawCookieValue = authTokenCookies
    .map((cookie) => cookie.value)
    .join("");
  const encodedSession = decodeURIComponent(rawCookieValue).replace(
    /^base64-/,
    "",
  );
  const session = JSON.parse(
    Buffer.from(encodedSession, "base64").toString("utf8"),
  );

  expect(session.access_token).toBeTruthy();
  expect(process.env.LOREM_IPSUM_PROJECT_ID).toBeTruthy();

  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
    "x-project-id": process.env.LOREM_IPSUM_PROJECT_ID!,
  };
}

export const getApiAuthHeaders = getApiWorkerAuthHeaders;
