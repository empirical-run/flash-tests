import { test, expect } from "./fixtures";
import {
  getNewSessionPromptInput,
  openNewWorkerSessionDialog,
} from "./pages/sessions";
import { isPreviewEnvironment } from "./pages/urls";

// The overdue invoice is seeded only on the preview deployment.
test.skip(
  () => !isPreviewEnvironment(),
  "The overdue-invoice project and unpaid invoice are seeded on preview only",
);
test.use({ selectedProjectSlug: "overdue-invoice" });

// In-session lease interruption needs a separate fixture that becomes blocked
// after creation; this already-overdue fixture exercises the creation gate only.
test("billing gate rejects worker session creation for an overdue invoice", async ({
  page,
}) => {
  await page.goto("/overdue-invoice/sessions");
  await expect(
    page.getByRole("button", { name: "OI Overdue Invoice" }),
  ).toBeVisible();

  await openNewWorkerSessionDialog(page);
  const initialMessage = "Hello, please reply with a greeting.";
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
  const billingMessage =
    "Your organisation has an invoice that is 14 or more days overdue. Pay it in Settings → Billing to continue.";
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
