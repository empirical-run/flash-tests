import { expect, Page, Request } from "@playwright/test";
import { EmailClient } from "@empiricalrun/playwright-utils";
import { getDashboardBaseUrl } from "./urls";
import { test } from "../fixtures";
import { mkdir, writeFile } from "node:fs/promises";
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

type RecentAccount = {
  client: EmailClient;
  adminPage: Page;
  userId?: string;
};

/** Search fetches server-side members, including accounts joined after Team loaded. */
export async function removeRecentUserMembership(
  account: RecentAccount,
): Promise<{
  userId?: string;
  removedMembership?: string;
  cleanup: "removed" | "not-present";
}> {
  const { adminPage, client } = account;
  const email = client.getAddress();
  await expect(adminPage).toHaveURL(/\/lorem-ipsum\/settings\/team$/);
  const searchResponse = adminPage.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      response.request().method() === "GET" &&
      /^\/api\/orgs\/\d+\/members$/.test(url.pathname) &&
      url.searchParams.get("search") === email
    );
  });
  await adminPage
    .getByPlaceholder("Search members", { exact: true })
    .fill(email);
  const search = await searchResponse;
  expect(search.ok()).toBeTruthy();
  const body = (await search.json()) as {
    data: { members: { id: string; email: string }[] };
  };
  const ownedMembers = body.data.members.filter(
    (member) => member.email === email,
  );
  expect(
    ownedMembers.length,
    "Cleanup must never select multiple members",
  ).toBeLessThanOrEqual(1);
  // Lifecycle-only conditional: signup may fail before joining the organization.
  // The failed setup remains failed; missing membership is not a scenario skip.
  if (ownedMembers.length === 0)
    return { userId: account.userId, cleanup: "not-present" };
  const member = ownedMembers[0];
  if (account.userId) expect(member.id).toBe(account.userId);
  await expect(
    adminPage.getByText(email, { exact: true }).first(),
  ).toBeVisible();
  await adminPage.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(
    adminPage.getByText(`Remove ${email}?`, { exact: true }),
  ).toBeVisible();
  const removal = adminPage.waitForResponse(
    (response) =>
      response.request().method() === "DELETE" &&
      new URL(response.url()).pathname.endsWith(`/members/${member.id}`),
  );
  // Confirmation makes the background inert; only its Remove CTA is accessible.
  await adminPage.getByRole("button", { name: "Remove", exact: true }).click();
  const response = await removal;
  expect(
    response.ok(),
    "Expected removal of only the owned member to succeed",
  ).toBeTruthy();
  await expect(adminPage.getByText(email, { exact: true })).toHaveCount(0);
  return {
    userId: member.id,
    removedMembership: new URL(response.url()).pathname,
    cleanup: "removed",
  };
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

// The resource fixture yields BEFORE signup, so its teardown also runs when the
// dependent signup/observer setup fails. No try/catch or scenario fallback.
export const persistenceTest = test.extend<{
  recentAccount: RecentAccount;
  isolatedRecentPage: Page;
  recentObserver: Page;
}>({
  recentAccount: async ({ page: adminPage }, use, testInfo) => {
    await adminPage.goto("/lorem-ipsum/settings/team");
    await expect(
      adminPage.getByRole("heading", { name: "Team", exact: true }),
    ).toBeVisible();
    const client = new EmailClient({ provider: "inbox" });
    const account: RecentAccount = { adminPage, client };
    // Lifecycle-managed output, private permissions, deliberately NOT attached.
    const metadataPath = testInfo.outputPath(".private-recent-fixture.json");
    await mkdir(testInfo.outputDir, { recursive: true });
    await writeFile(
      metadataPath,
      JSON.stringify({ email: client.getAddress(), cleanup: "pending" }),
      { mode: 0o600 },
    );
    await use(account);
    const cleanup = await removeRecentUserMembership(account);
    await writeFile(
      metadataPath,
      JSON.stringify({ email: client.getAddress(), ...cleanup }),
    );
    // Profile has no supported full-account deletion UI; this removes membership only.
  },
  isolatedRecentPage: async (
    { recentAccount, customContextPageProvider },
    use,
  ) => {
    const { page, context } = await customContextPageProvider({
      storageState: undefined,
    });
    recentAccount.userId = await signUpRecentUser(page, recentAccount.client);
    await context.addCookies([
      {
        name: "selected_project_slug",
        value: "lorem-ipsum",
        url: getDashboardBaseUrl(),
      },
    ]);
    await use(page);
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
    await expect(
      observer.getByRole("button", { name: /Lorem Ipsum/ }),
      "Fresh confirmed user must have Lorem Ipsum access through the configured email-domain membership",
    ).toBeVisible();
    await use(observer);
    // Runs even if the UI/GET assertion fails. Root must remain genuinely untracked.
    expect(
      writes,
      "Neutral observer must not issue any Recent PUT, including Memories",
    ).toEqual([]);
    await observer.close();
  },
});
