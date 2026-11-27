import { randomUUID } from "node:crypto";
import { EmailClient } from "@empiricalrun/playwright-utils";
import { cleanupInvitedTeamMember } from "../../pages/team";
import { test as base, expect } from "./index";

export type InvitationFixture = {
  client: EmailClient;
  email: string;
  /** Set once the inviter's org is known, so teardown removes the invitee. */
  orgId?: number;
};

/**
 * A fresh `org-invite-<uuid>+noautojoin@empiricalrun.email` inbox. `+noautojoin`
 * disables domain auto-join, so the invitee can only reach the org via the
 * invite. Teardown uses the inviter's `page` session to revoke/remove it.
 */
export const test = base.extend<{ invitationFixture: InvitationFixture }>({
  invitationFixture: async ({ page }, use) => {
    // Construct before any email is sent, retaining the exact plus address.
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

export { expect };
