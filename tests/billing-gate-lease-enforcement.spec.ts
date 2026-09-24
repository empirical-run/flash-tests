import { test, expect } from "./fixtures";
import {
  createWorkerSession,
  getChatMessageByText,
  sendMessage,
  waitForAgentIdle,
} from "./pages/sessions";
import { isPreviewEnvironment } from "./pages/urls";

// The overdue invoice is seeded only on the preview deployment.
test.skip(
  () => !isPreviewEnvironment(),
  "The overdue-invoice project and unpaid invoice are seeded on preview only",
);
test.use({ selectedProjectSlug: "overdue-invoice" });

test("billing gate aborts a worker turn and rejects the next message", async ({
  page,
  trackCurrentSession,
}) => {
  test.setTimeout(180000);

  await page.goto("/overdue-invoice/sessions");
  await expect(
    page.getByRole("button", { name: "OI Overdue Invoice" }),
  ).toBeVisible();

  // The first message is the initial prompt submitted with the create-session
  // dialog; worker mode is supported by the API but not yet offered in the UI.
  const initialMessage = "Hello, please reply with a greeting.";
  const sessionId = await createWorkerSession(page, initialMessage);
  trackCurrentSession(page);

  const sessionResponse = await page.request.get(
    `/api/chat-sessions/${sessionId}`,
  );
  expect(sessionResponse.ok()).toBeTruthy();
  expect((await sessionResponse.json()).data.chat_session.mode).toBe("worker");
  await expect(getChatMessageByText(page, initialMessage)).toBeVisible();

  // The lease enforcement stops the first turn. This is a persistent error in
  // the Messages region, not a transient toast or a tool-call result.
  const messages = page.getByRole("region", { name: "Messages" });
  await expect(
    messages.getByText("Request aborted", { exact: true }),
  ).toBeVisible({
    timeout: 120000,
  });
  await waitForAgentIdle(page, 120000);

  const followUp = "Please reply once more.";
  const rejectedMessage = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/chat-sessions/${sessionId}/message`) &&
      response.request().method() === "POST",
  );
  await sendMessage(page, followUp);
  const response = await rejectedMessage;
  expect(response.status()).toBe(402);
  expect((await response.json()).error.message).toContain(
    "invoice that is 14 or more days overdue",
  );
  await waitForAgentIdle(page, 120000);

  // The UI explains the rejected send in the Messages region; the project-wide
  // invoice warning remains visible separately with role="status" on preview.
  await expect(
    messages.getByText("Error sending message", { exact: true }),
  ).toBeVisible();
  await expect(
    messages.getByText(
      "Your organisation has an invoice that is 14 or more days overdue. Pay it in Settings → Invoices to continue.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page
      .getByRole("status")
      .getByText("An invoice on your account is 14 or more days overdue.", {
        exact: true,
      }),
  ).toBeVisible();
  await expect(getChatMessageByText(page, followUp)).toHaveCount(0);
});
