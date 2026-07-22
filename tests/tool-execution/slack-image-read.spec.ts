import { test, expect } from "../fixtures";
import { createSession, getChatMessageByText, navigateToSessions, waitForAgentToFinish } from "../pages/sessions";

// SETUP DEPENDENCY (out-of-band Slack test data):
// This test relies on a fixture image having been shared into the Slack channel
// "#new-channel" that is connected to the Lorem Ipsum project, on 22 July 2026.
// The image is a dashboard screenshot whose amber info banner reads
// "An invoice on your account is unpaid past its due date."
// The Empirical Slack app must be installed/authorized so the agent can download
// files from that channel. If the message/image is deleted, the channel is renamed,
// or the app integration is removed, this test will fail — re-share the fixture image
// and/or reconnect the Slack app to fix it.
test.describe('Slack Image Reading', () => {
  test('agent reads an image shared in a Slack channel and reports the info banner text', async ({ page, trackCurrentSession }) => {
    // Reading a Slack image, downloading it, and inspecting it can take a while, so
    // give the agent a generous budget to finish the turn.
    test.setTimeout(420000);

    await navigateToSessions(page);

    // Mirror the real prompt a user sent, but pin the date instead of "today" so the
    // agent can deterministically locate the image on every run. The fixture image was
    // shared into the #new-channel Slack channel on 22 July 2026.
    const prompt = "I shared an image on #new-channel on 22 July 2026 - can you read it and tell me what is the text in the info banner?";
    await createSession(page, prompt);

    // Track the session for automatic cleanup
    trackCurrentSession(page);

    // Wait for the agent to finish resolving the Slack file and inspecting the image.
    await waitForAgentToFinish(page, 360000);

    // The banner in the shared image reads:
    // "An invoice on your account is unpaid past its due date."
    await expect(
      getChatMessageByText(page, /An invoice on your account is unpaid past its due date/i, 'last')
    ).toBeVisible({ timeout: 120000 });

    // Session will be automatically closed by afterEach hook
  });
});
