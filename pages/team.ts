import { expect, Page } from "@playwright/test";
import { expectHomeLoaded } from "./home";
import { loginWithPassword } from "./login";
import { navigateToSettings } from "./settings";
import { CurrentUser, getCurrentUser } from "./users";

export type TeamOrg = { id: number; name: string };

/** Logs in as the normal (non-super-admin) automated user who sends invites. */
export async function loginAsInviter(page: Page): Promise<CurrentUser> {
  await page.goto("/login");
  await loginWithPassword(page);
  await expectHomeLoaded(page);
  const inviter = await getCurrentUser(page);
  expect(inviter.is_super_admin).toBe(false);
  return inviter;
}

/** Opens Settings → Team and returns the org it manages. */
export async function openTeamSettings(page: Page): Promise<TeamOrg> {
  const orgLoaded = page.waitForResponse(
    (response) =>
      /\/api\/projects\/\d+\/org$/.test(new URL(response.url()).pathname) &&
      response.ok(),
  );
  await navigateToSettings(page, "Team");
  const {
    data: { org },
  } = await (await orgLoaded).json();
  await expect(
    page.getByRole("heading", { name: "Team", exact: true }),
  ).toBeVisible();
  return org;
}

/** Sends an invite from the open Team page and waits for its Pending row. */
export async function inviteTeamMember(page: Page, email: string) {
  await page.getByRole("textbox", { name: "teammate@example.com" }).fill(email);
  await page.getByRole("button", { name: "Invite", exact: true }).click();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await expect(getPendingTeamInvite(page, email).locator("..")).toContainText(
    "Pending",
  );
}

/** On a fresh Team page: the email is a removable member and has no pending invite. */
export async function expectTeamMemberJoined(page: Page, email: string) {
  await navigateToSettings(page, "Team");
  await page.getByRole("textbox", { name: "Search members" }).fill(email);
  await expect(
    getTeamMember(page, email).getByRole("button", {
      name: "Remove",
      exact: true,
    }),
  ).toBeVisible();
  await expect(getPendingTeamInvite(page, email)).toHaveCount(0);
}

/** Pending invite rows have a recipient-specific revoke action. */
export function getPendingTeamInvite(page: Page, email: string) {
  return page.getByRole("button", {
    name: `Revoke invite for ${email}`,
    exact: true,
  });
}

/** The member's display name and exact email sit together inside their row. */
export function getTeamMember(page: Page, email: string) {
  return page
    .getByText(email, { exact: true })
    .first()
    .locator("..")
    .locator("..");
}

type Invite = { id: number; email: string; status: string };
type Member = { id: string; email: string };

/**
 * Remove only this test's exact-email fixture, including on failure before signup.
 * Accepted invites are historical records; only pending invites need revoking.
 * Dashboard API requests use the inviter's browser session, not an admin API key.
 */
export async function cleanupInvitedTeamMember(
  page: Page,
  orgId: number,
  email: string,
) {
  expect(email).toMatch(
    /^org-invite-[a-f0-9-]+\+noautojoin@empiricalrun\.email$/,
  );
  const invitesUrl = `/api/orgs/${orgId}/invites`;
  const membersUrl = `/api/orgs/${orgId}/members`;
  const searchUrl = `${membersUrl}?page=1&per_page=10&search=${encodeURIComponent(email)}`;

  const invitesResponse = await page.request.get(invitesUrl);
  expect(invitesResponse.ok()).toBeTruthy();
  const {
    data: { invites },
  }: { data: { invites: Invite[] } } = await invitesResponse.json();
  for (const invite of invites.filter(
    (item) => item.email === email && item.status === "pending",
  )) {
    const response = await page.request.delete(`${invitesUrl}/${invite.id}`);
    expect(response.ok()).toBeTruthy();
  }

  const membersResponse = await page.request.get(searchUrl);
  expect(membersResponse.ok()).toBeTruthy();
  const {
    data: { members },
    pagination,
  }: {
    data: { members: Member[] };
    pagination: { total: number };
  } = await membersResponse.json();
  expect(pagination.total).toBeLessThanOrEqual(1);
  for (const member of members) {
    expect(member.email).toBe(email);
    const response = await page.request.delete(`${membersUrl}/${member.id}`);
    expect(response.ok()).toBeTruthy();
  }

  // Fresh readbacks prove cleanup rather than trusting deletion acknowledgements.
  const invitesReadback = await page.request.get(invitesUrl);
  expect(invitesReadback.ok()).toBeTruthy();
  const {
    data: { invites: remainingInvites },
  }: { data: { invites: Invite[] } } = await invitesReadback.json();
  expect(
    remainingInvites.filter(
      (item) => item.email === email && item.status === "pending",
    ),
  ).toEqual([]);
  const membersReadback = await page.request.get(searchUrl);
  expect(membersReadback.ok()).toBeTruthy();
  expect((await membersReadback.json()).pagination.total).toBe(0);
}
