import { test, expect } from "../../lib/fixtures/org-invite";
import {
  confirmSignupFromEmail,
  submitPasswordSignup,
} from "../../pages/signup";
import {
  expectTeamMemberJoined,
  inviteTeamMember,
  loginAsInviter,
  openTeamSettings,
} from "../../pages/team";
import { expectProjectTestRunsAccessible } from "../../pages/test-runs";
import { toDashboardUrl } from "../../pages/urls";

// This project starts unauthenticated; the inviter logs in normally and the
// invitee uses an entirely separate context with no inherited cookies.
test("a non-admin can invite a new +noautojoin user into their org", async ({
  page,
  customContextPageProvider,
  invitationFixture,
}) => {
  const { client, email: invitedEmail } = invitationFixture;
  expect(invitedEmail).toMatch(/\+noautojoin@empiricalrun\.email$/);

  const inviter = await loginAsInviter(page);
  const org = await openTeamSettings(page);
  invitationFixture.orgId = org.id;

  const invitedAfter = new Date();
  await inviteTeamMember(page, invitedEmail);

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

  const { page: inviteePage } = await customContextPageProvider({
    storageState: undefined,
  });
  await inviteePage.goto(toDashboardUrl(signupLink!.href));
  const signupAfter = await submitPasswordSignup(
    inviteePage,
    invitedEmail,
    "TestPassword123!",
  );
  await confirmSignupFromEmail(inviteePage, client, invitedEmail, signupAfter);
  // Signup may select any project in the org; explicitly verify access to the
  // inviting project rather than assuming it is the landing project.
  await expectProjectTestRunsAccessible(inviteePage);

  await expectTeamMemberJoined(page, invitedEmail);
});
