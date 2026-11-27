import { test, expect } from "../../lib/fixtures/org-invite";
import { loginWithEmailAndPassword } from "../../pages/login";
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
import { getDashboardBaseUrl, isNoOrgRoute } from "../../pages/urls";
import { getCurrentUser } from "../../pages/users";

const inviteePassword = "TestPassword123!";

// Regression: password sign-in used to skip pending invite acceptance (only the
// OAuth callback and email confirmation accepted them), so a confirmed user with
// no org who was invited later landed on /onboarding instead of the org.
test("an existing password user with no org joins via a pending invite on password sign-in", async ({
  page,
  customContextPageProvider,
  invitationFixture,
}) => {
  const { client, email: inviteeEmail } = invitationFixture;
  expect(inviteeEmail).toMatch(/\+noautojoin@empiricalrun\.email$/);
  const baseUrl = getDashboardBaseUrl();

  // Before any invite: sign up and confirm, which leaves the user with no org.
  const { page: signupPage, context: signupContext } =
    await customContextPageProvider({ storageState: undefined });
  await signupPage.goto(`${baseUrl}/signup`);
  const signupAfter = await submitPasswordSignup(
    signupPage,
    inviteeEmail,
    inviteePassword,
  );
  await confirmSignupFromEmail(signupPage, client, inviteeEmail, signupAfter);
  await expect(signupPage).toHaveURL((url) => url.pathname === "/onboarding");
  await expect(
    signupPage.getByRole("heading", { name: "Create Your Organization" }),
  ).toBeVisible();
  await expect(
    signupPage.getByText(
      "Organization already on Empirical? Ask an admin to invite you.",
    ),
  ).toBeVisible();
  expect((await getCurrentUser(signupPage)).org_ids).toEqual([]);
  // Drop this session so the later sign-in can't reuse its cookies.
  await signupContext.close();

  await loginAsInviter(page);
  const org = await openTeamSettings(page);
  invitationFixture.orgId = org.id;
  await inviteTeamMember(page, inviteeEmail);

  // Sign in with the password only: no invite email, no magic link.
  const { page: inviteePage } = await customContextPageProvider({
    storageState: undefined,
  });
  const visitedUrls: string[] = [];
  inviteePage.on("framenavigated", (frame) => {
    if (frame === inviteePage.mainFrame()) visitedUrls.push(frame.url());
  });
  await inviteePage.goto(`${baseUrl}/login`);
  await loginWithEmailAndPassword(inviteePage, inviteeEmail, inviteePassword);
  await expect(inviteePage).not.toHaveURL((url) => url.pathname === "/login", {
    timeout: 15000,
  });
  await expect(
    inviteePage.getByRole("button", { name: inviteeEmail, exact: true }),
  ).toBeVisible({ timeout: 15000 });
  expect((await getCurrentUser(inviteePage)).org_ids).toContain(org.id);
  await expectProjectTestRunsAccessible(inviteePage);
  // Before the fix, sign-in landed on /onboarding; it must never be visited.
  expect(visitedUrls.filter((href) => isNoOrgRoute(new URL(href)))).toEqual([]);

  await expectTeamMemberJoined(page, inviteeEmail);
});
