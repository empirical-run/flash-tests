import { test, expect } from "../fixtures";
import {
  createWorkerSession,
  getChatMessageByText,
  navigateToSessions,
  waitForAgentToFinish,
} from "../pages/sessions";

// EXPLORATORY WORKER-MODE VARIANT.
// This deliberately remains separate from slack-image-read.spec.ts so the stable
// default chat-mode coverage is preserved while worker-mode vision is evaluated.
//
// SETUP DEPENDENCY (out-of-band Slack test data):
// This test relies on a fixture image in the Slack channel "#new-channel" that is
// connected to the Lorem Ipsum project. It was shared around 20–22 July 2026; Slack
// reports its file-created date as 20 July even though it may have been shared later.
// The image is a dashboard screenshot whose amber info banner reads
// "An invoice on your account is unpaid past its due date."
test.describe("Slack Image Reading — Worker Mode", () => {
  test.skip(
    process.env.TEST_RUN_ENVIRONMENT === "preview" ||
      process.env.ENV_SLUG === "preview",
    "Slack image-reading fixture/integration is not available on preview.",
  );

  test("worker agent reads a Slack image and reports the info banner text", async ({
    page,
    trackCurrentSession,
  }) => {
    test.setTimeout(420000);

    await navigateToSessions(page);

    const prompt =
      "I shared an image in #new-channel around 20–22 July 2026. Its Slack file-created date may be 20 July even if it was shared later. Find the image, broadening the search beyond the exact date if necessary, download it, and tell me the exact text in the info banner.";
    await createWorkerSession(page, prompt);
    trackCurrentSession(page);

    await waitForAgentToFinish(page, 360000);

    await expect(
      getChatMessageByText(
        page,
        /An invoice on your account is unpaid past its due date/i,
        "last",
      ),
    ).toBeVisible({ timeout: 120000 });
  });
});
