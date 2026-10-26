import { randomUUID } from "node:crypto";
import { EmailClient } from "@empiricalrun/playwright-utils";
import { test as base, expect } from "../fixtures";
import { expectHomeLoaded } from "../pages/home";
import { loginWithPassword } from "../pages/login";
import { navigateToSettings, getProjectSlug } from "../pages/settings";
import { getDashboardBaseUrl } from "../pages/urls";
import {
  cleanupInvitedTeamMember,
  getPendingTeamInvite,
  getTeamMember,
} from "../pages/team";

type InvitationFixture = { client: EmailClient; email: string; orgId?: number };
const test = base.extend<{ invitationFixture: InvitationFixture }>({
  invitationFixture: async ({ page }, use) => {
    // Construct before sending either email, retaining the exact plus address.
    const client = new EmailClient({
      provider: "inbox",
      emailId: `org-invite-${randomUUID()}+noautojoin`,
    });
    const invitation: InvitationFixture = {
      client,
      email: client.getAddress(),
    };
    await use(invitation);
    if (invitation.orgId !== undefined) {
      await cleanupInvitedTeamMember(page, invitation.orgId, invitation.email);
    }
  },
});

// This project starts unauthenticated; the inviter logs in normally and the
// invitee uses an entirely separate context with no inherited cookies.
test("a non-admin can invite a new +noautojoin user into their org", async ({
  page,
  customContextPageProvider,
  invitationFixture,
}) => {
  const { client, email: invitedEmail } = invitationFixture;
  expect(invitedEmail).toMatch(/\+noautojoin@empiricalrun\.email$/);

  await page.goto("/login");
  await loginWithPassword(page);
  await expectHomeLoaded(page);
  const userResponse = await page.request.get("/api/users/me");
  expect(userResponse.ok()).toBeTruthy();
  const { data: inviter } = await userResponse.json();
  expect(inviter.is_super_admin).toBe(false);

  const orgLoaded = page.waitForResponse(
    (response) =>
      /\/api\/projects\/\d+\/org$/.test(new URL(response.url()).pathname) &&
      response.ok(),
  );
  await navigateToSettings(page, "Team");
  const {
    data: { org },
  } = await (await orgLoaded).json();
  invitationFixture.orgId = org.id;
  await expect(
    page.getByRole("heading", { name: "Team", exact: true }),
  ).toBeVisible();

  const invitedAfter = new Date();
  await page
    .getByRole("textbox", { name: "teammate@example.com" })
    .fill(invitedEmail);
  await page.getByRole("button", { name: "Invite", exact: true }).click();
  await expect(page.getByText(invitedEmail, { exact: true })).toBeVisible();
  const pendingInvite = getPendingTeamInvite(page, invitedEmail);
  await expect(pendingInvite.locator("..")).toContainText("Pending");

  const invitation = await client.waitForEmail({
    receivedAfter: invitedAfter,
  });
  expect(invitation.subject).toBe(
    `${inviter.email} invited you to ${org.name} on Empirical`,
  );
  const signupLink = invitation.links.find(
    (link) => new URL(link.href).pathname === "/signup",
  );
  expect(signupLink, "Invite email includes a signup link").toBeTruthy();
  const signupUrl = new URL(signupLink!.href);
  const baseUrl = getDashboardBaseUrl();
  const transformedSignupUrl = `${baseUrl}${signupUrl.pathname}${signupUrl.search}${signupUrl.hash}`;

  const { page: inviteePage } = await customContextPageProvider({
    storageState: undefined,
  });
  await inviteePage.goto(transformedSignupUrl);
  await inviteePage.getByRole("textbox", { name: "Email" }).fill(invitedEmail);
  await inviteePage
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await inviteePage
    .getByRole("textbox", { name: "Password" })
    .fill("TestPassword123!");
  const signupAfter = new Date();
  await inviteePage.getByRole("button", { name: "Create account" }).click();
  await expect(
    inviteePage.getByText(
      `We sent a confirmation link to ${invitedEmail}. Click the link in the email to finish creating your account.`,
    ),
  ).toBeVisible();
  const confirmation = await client.waitForEmail({
    receivedAfter: signupAfter,
  });
  const confirmLink = confirmation.links.find((link) =>
    link.href.includes("/magic-link-landing"),
  );
  expect(confirmLink).toBeTruthy();
  const confirmUrl = new URL(confirmLink!.href);
  await inviteePage.goto(
    `${baseUrl}${confirmUrl.pathname}${confirmUrl.search}${confirmUrl.hash}`,
  );
  await inviteePage.getByRole("button", { name: "Confirm Signup" }).click();
  await expect(
    inviteePage.getByRole("button", { name: invitedEmail, exact: true }),
  ).toBeVisible({ timeout: 15000 });
  // Signup may select any project in the org; explicitly verify access to the
  // inviting project rather than assuming it is the landing project.
  await inviteePage.goto(`${baseUrl}/${getProjectSlug()}/test-runs`);
  await expect(
    inviteePage.getByRole("link", { name: "Test Runs", exact: true }),
  ).toHaveAttribute("href", `/${getProjectSlug()}/test-runs`);
  await expect(inviteePage).toHaveURL(
    `${baseUrl}/${getProjectSlug()}/test-runs`,
  );
  await expect(
    inviteePage.getByRole("heading", { name: "Test Runs", exact: true }),
  ).toBeVisible();
  // Preview hostnames can contain "onboarding"; only routes indicate a redirect.
  await expect(inviteePage).not.toHaveURL((url) =>
    /^\/(?:onboarding|create-org|signup)(?:\/|$)/.test(url.pathname),
  );

  await navigateToSettings(page, "Team");
  await page
    .getByRole("textbox", { name: "Search members" })
    .fill(invitedEmail);
  await expect(
    getTeamMember(page, invitedEmail).getByRole("button", {
      name: "Remove",
      exact: true,
    }),
  ).toBeVisible();
  await expect(pendingInvite).toHaveCount(0);
});
