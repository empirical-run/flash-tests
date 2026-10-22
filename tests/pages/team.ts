import { expect, Page } from "@playwright/test";

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
