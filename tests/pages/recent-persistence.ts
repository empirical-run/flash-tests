import { expect, Page, Request } from "@playwright/test";
import { EmailClient } from "@empiricalrun/playwright-utils";
import { getDashboardBaseUrl } from "./urls";
import { test } from "../fixtures";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RecentPageRecord } from "./command-bar";

/** UI-created account: the configured email domain grants access to Lorem Ipsum. */
export async function signUpRecentUser(
  page: Page,
  client: EmailClient,
): Promise<string> {
  const email = client.getAddress();
  await page.goto("/signup");
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("button", { name: "Continue" }).click();
  await page
    .getByRole("textbox", { name: "Password" })
    .fill("TestPassword123!");
  const signupResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/auth/v1/signup",
  );
  await page.getByRole("button", { name: "Create account" }).click();
  const signup = await signupResponse;
  expect(signup.ok()).toBeTruthy();
  const user = (await signup.json()) as { id: string };
  expect(user.id).toBeTruthy();
  await expect(
    page.getByText(
      `We sent a confirmation link to ${email}. Click the link in the email to finish creating your account.`,
    ),
  ).toBeVisible();

  const message = await client.waitForEmail();
  const link = message.links.find((item) =>
    item.href.includes("/magic-link-landing"),
  );
  expect(link, "Expected the signup confirmation link").toBeTruthy();
  await page.goto(
    link!.href.replace(/^https?:\/\/localhost:\d+/, getDashboardBaseUrl()),
  );
  await page.getByRole("button", { name: "Confirm Signup" }).click();
  await expect(
    page.getByRole("button", { name: email, exact: true }),
  ).toBeVisible();
  return user.id;
}

/** Remove only this fixture's membership; never delete other users or change domains. */
export async function removeRecentUserMembership(
  adminPage: Page,
  email: string,
  userId: string,
): Promise<string> {
  await expect(adminPage).toHaveURL(/\/lorem-ipsum\/settings\/team$/);
  await adminPage
    .getByPlaceholder("Search members", { exact: true })
    .fill(email);
  await expect(
    adminPage.getByText(email, { exact: true }).first(),
  ).toBeVisible();
  await adminPage.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(
    adminPage.getByText(`Remove ${email}?`, { exact: true }),
  ).toBeVisible();
  // The confirmation makes the background inert; this is the accessible confirm CTA.
  const removal = adminPage.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      new URL(response.url()).pathname.endsWith(`/members/${userId}`),
  );
  await adminPage.getByRole("button", { name: "Remove", exact: true }).click();
  const response = await removal;
  expect(
    response.ok(),
    "Expected removal of only the owned member to succeed",
  ).toBeTruthy();
  await expect(adminPage.getByText(email, { exact: true })).toHaveCount(0);
  return new URL(response.url()).pathname;
}

export function isRecentRequest(request: Request, method: string): boolean {
  return (
    request.method() === method &&
    new URL(request.url()).pathname === "/api/recent-pages"
  );
}

/** Read-only observer: no optimistic current-destination write can prove persistence. */
export async function reloadRecentObserver(
  observer: Page,
): Promise<RecentPageRecord[]> {
  const read = observer.waitForResponse((response) =>
    isRecentRequest(response.request(), "GET"),
  );
  await observer.reload();
  const response = await read;
  expect(
    response.ok(),
    "Expected the observer reload Recent GET to succeed",
  ).toBeTruthy();
  const body = (await response.json()) as {
    data: { recent_pages: RecentPageRecord[] };
  };
  return body.data.recent_pages;
}

export function expectPersistedRecentRecord(
  records: RecentPageRecord[],
  seed: RecentPageRecord,
): void {
  const persisted = records.find(
    (record) =>
      record.page_id === seed.page_id &&
      record.project_id === seed.project_id &&
      record.path === seed.path,
  );
  expect(
    persisted,
    `Reload GET must restore the exact seeded destination; seed=${JSON.stringify(seed)}, returned=${JSON.stringify(records)}`,
  ).toBeDefined();
  expect(persisted!.title).toBe(seed.title);
  // Relative to this account's own acknowledged write, not an arbitrary age threshold.
  expect(persisted!.viewed_at).toBe(seed.viewed_at);
}

// Only persistence needs an isolated principal; the other scenarios stay unchanged.
export const persistenceTest = test.extend<{
  isolatedRecentPage: Page;
  recentObserver: Page;
}>({
  isolatedRecentPage: async (
    { page: adminPage, customContextPageProvider },
    use,
    testInfo,
  ) => {
    // Establish cleanup access before creating anything; retain this loaded admin
    // page rather than depend on another document load after a failing scenario.
    await adminPage.goto("/lorem-ipsum/settings/team");
    await expect(
      adminPage.getByRole("heading", { name: "Team", exact: true }),
    ).toBeVisible();
    const client = new EmailClient({ provider: "inbox" });
    const { page, context } = await customContextPageProvider({
      storageState: undefined,
    });
    const privateDirectory = join(tmpdir(), "recent-persistence-fixtures");
    await mkdir(privateDirectory, { recursive: true, mode: 0o700 });
    const metadataPath = join(
      privateDirectory,
      `${testInfo.testId}-${testInfo.retry}-${client.getAddress()}.json`,
    );
    await writeFile(
      metadataPath,
      JSON.stringify({ email: client.getAddress(), membershipRemoved: false }),
      { mode: 0o600 },
    );
    const userId = await signUpRecentUser(page, client);
    await writeFile(
      metadataPath,
      JSON.stringify({
        email: client.getAddress(),
        userId,
        membershipRemoved: false,
      }),
    );
    await context.addCookies([
      {
        name: "selected_project_slug",
        value: "lorem-ipsum",
        url: getDashboardBaseUrl(),
      },
    ]);
    await use(page);
    const removedMembership = await removeRecentUserMembership(
      adminPage,
      client.getAddress(),
      userId,
    );
    await writeFile(
      metadataPath,
      JSON.stringify({
        email: client.getAddress(),
        userId,
        removedMembership,
        membershipRemoved: true,
      }),
    );
    // No supported account-deletion UI exists; only the owned membership is removed.
  },
  recentObserver: async ({ isolatedRecentPage }, use) => {
    const observer = await isolatedRecentPage.context().newPage();
    const writes: string[] = [];
    observer.on("request", (request) => {
      if (isRecentRequest(request, "PUT")) writes.push(request.url());
    });
    const initialRead = observer.waitForResponse((response) =>
      isRecentRequest(response.request(), "GET"),
    );
    await observer.goto("/");
    await expect(
      observer.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();
    expect((await initialRead).ok()).toBeTruthy();
    await use(observer);
    // Runs even if the UI/GET assertion fails. Root must remain genuinely untracked.
    expect(
      writes,
      "Neutral observer must not issue any Recent PUT, including Memories",
    ).toEqual([]);
    await observer.close();
  },
});
