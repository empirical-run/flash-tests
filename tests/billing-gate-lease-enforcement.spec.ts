import { test as base, expect } from "./fixtures";
import {
  closeSeededSession,
  seedWorkerSession,
  SeededSession,
} from "./pages/seed-session";
import {
  getChatMessageByText,
  getNewSessionPromptInput,
  openNewWorkerSessionDialog,
  sendMessage,
  waitForAgentIdle,
} from "./pages/sessions";
import { isPreviewEnvironment } from "./pages/urls";

const initialMessage = "Hello, please reply with a greeting.";
const initialReply = "Hello! How can I help?";
const billingMessage =
  "Your organisation has an invoice that is 14 or more days overdue. Pay it in Settings → Billing to continue.";

const test = base.extend<{ seededBillingSession: SeededSession }>({
  seededBillingSession: async ({ page }, use) => {
    const session = await seedWorkerSession(page, "overdue-invoice", [
      { role: "user", text: initialMessage },
      { role: "assistant", text: initialReply },
    ]);
    await use(session);
    await closeSeededSession(page, session);
  },
});

// The overdue invoice is seeded only on the preview deployment.
test.skip(
  () => !isPreviewEnvironment(),
  "The overdue-invoice project and unpaid invoice are seeded on preview only",
);
test.use({ selectedProjectSlug: "overdue-invoice" });

test("billing gate rejects worker session creation for an overdue invoice", async ({
  page,
}) => {
  await page.goto("/overdue-invoice/sessions");
  await expect(
    page.getByRole("button", { name: "OI Overdue Invoice" }),
  ).toBeVisible();

  await openNewWorkerSessionDialog(page);
  await getNewSessionPromptInput(page).fill(initialMessage);

  const rejectedCreation = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/chat-sessions" &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("dialog", { name: "Create new session" })
    .getByRole("button", { name: "Create", exact: true })
    .click();
  const response = await rejectedCreation;
  expect(response.request().postDataJSON()).toMatchObject({
    message: initialMessage,
    agent: "worker",
  });
  expect(response.status()).toBe(402);
  const body = await response.json();
  expect(body.error.message).toBe(billingMessage);
  expect(body.data).toBeNull();

  // Assert the creation-error toast, not the persistent project billing banner.
  await expect(
    page
      .getByRole("region", { name: "Notifications alt+T", exact: true })
      .getByText(billingMessage, { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/sessions\/?$/);

  const screenshotPath = test
    .info()
    .outputPath("session-creation-billing-error.png");
  await page.screenshot({ path: screenshotPath });
  await test.info().attach("session-creation-billing-error", {
    path: screenshotPath,
    contentType: "image/png",
  });
});

test("billing gate rejects the next message in a seeded worker session", async ({
  page,
  seededBillingSession: session,
}) => {
  await page.goto(`/sessions/${session.id}`);
  await expect(page).toHaveURL(new RegExp(`/sessions/${session.id}$`));
  test
    .info()
    .annotations.push({ type: "Session URL", description: page.url() });

  const sessionResponse = await page.request.get(
    `/api/chat-sessions/${session.id}`,
    {
      headers: session.headers,
    },
  );
  expect(sessionResponse.ok()).toBeTruthy();
  expect((await sessionResponse.json()).data.chat_session).toMatchObject({
    id: session.id,
    project_id: session.projectId,
    mode: "worker",
  });
  await expect(getChatMessageByText(page, initialMessage)).toBeVisible();
  await expect(getChatMessageByText(page, initialReply)).toBeVisible();
  await waitForAgentIdle(page);

  const followUp = "Please reply once more.";
  const rejectedMessage = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname ===
        `/api/chat-sessions/${session.id}/message` &&
      response.request().method() === "POST",
  );
  await sendMessage(page, followUp);
  const response = await rejectedMessage;
  expect(response.status()).toBe(402);
  expect((await response.json()).error.message).toBe(billingMessage);

  const messages = page.getByRole("region", { name: "Messages", exact: true });
  const sendError = messages.getByRole("alert").filter({
    has: page.getByText("Error sending message", { exact: true }),
  });
  await expect(sendError).toBeVisible();
  await expect(
    sendError.getByText(billingMessage, { exact: true }),
  ).toBeVisible();
  await expect(getChatMessageByText(page, followUp)).toHaveCount(0);
  await expect(getChatMessageByText(page, initialMessage)).toBeVisible();
  await expect(getChatMessageByText(page, initialReply)).toBeVisible();
  await waitForAgentIdle(page);

  const screenshotPath = test.info().outputPath("in-session-billing-error.png");
  await page.screenshot({ path: screenshotPath });
  await test.info().attach("in-session-billing-error", {
    path: screenshotPath,
    contentType: "image/png",
  });
});
