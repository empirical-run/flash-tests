import { test, expect } from "./fixtures";
import {
  getWebhookUrl,
  queryWebhookRequests,
} from "@empiricalrun/playwright-utils";
import { createHmac } from "crypto";
import { navigateToSettings } from "./pages/settings";
import {
  openNewTestRunDialog,
  triggerTestRunAndNavigate,
} from "./pages/test-runs";

const TEST_RUN_EVENTS_WEBHOOK_URL =
  process.env.TEST_RUN_EVENTS_WEBHOOK_URL ||
  (process.env.TEST_RUN_ENVIRONMENT === "preview"
    ? "https://inbox.empirical.run/hooks/flash-tests-test-run-events-preview"
    : "https://inbox.empirical.run/hooks/flash-tests-test-run-events-production");

async function deleteWebhookByToken(page: any, webhookToken: string) {
  await navigateToSettings(page, "Webhooks");
  await expect(page.getByRole("button", { name: "Add Webhook" })).toBeVisible();

  const webhookRow = page
    .getByRole("row")
    .filter({ hasText: webhookToken.substring(0, 8) });
  await expect(webhookRow).toBeVisible();
  await webhookRow.getByRole("button").last().click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(webhookRow).not.toBeVisible();
}

async function expectTestRunWebhook(
  webhookUrl: string,
  eventType: string,
  testRunId: number,
) {
  await expect(webhookUrl).toHaveReceivedWebhook({
    content: [eventType, String(testRunId)],
    timeout: 120000,
  });

  const requests = await queryWebhookRequests(webhookUrl, [
    eventType,
    String(testRunId),
  ]);
  expect(requests.length).toBeGreaterThan(0);

  const payloadText = requests[0].content;
  const payload = JSON.parse(payloadText);
  const serializedPayload = JSON.stringify(payload);

  expect(serializedPayload).toContain(eventType);
  expect(serializedPayload).toContain(String(testRunId));
}

test.describe("Webhooks", () => {
  test("Add new webhook, run test webhook, and assert it", async ({ page }) => {
    // Generate a unique inbox webhook URL for this test
    const webhookUrl = await getWebhookUrl({ provider: "inbox" });

    await navigateToSettings(page, "Webhooks");
    await expect(
      page.getByRole("button", { name: "Add Webhook" }),
    ).toBeVisible();

    // Add a new webhook
    await page.getByRole("button", { name: "Add Webhook" }).click();
    await page.getByRole("textbox", { name: "Payload URL" }).fill(webhookUrl);
    await page.getByRole("checkbox", { name: "Select all events" }).click();
    await page.getByRole("button", { name: "Create" }).click();

    // After creation, the app shows a "Save your webhook secret" modal
    // Capture the secret (format: whsec_<base64url>) for signature verification
    // Use a specific locator to distinguish the actual secret from the "whsec_" placeholder in the instructions
    const webhookSecret = await page
      .locator("code")
      .filter({ hasText: /^whsec_.{10,}/ })
      .textContent();
    expect(webhookSecret).toMatch(/^whsec_/);
    await page.getByRole("button", { name: "Done" }).click();

    // Webhook row should be visible in the list
    const webhookToken = webhookUrl.split("/").pop()!;
    const webhookRow = page
      .getByRole("row")
      .filter({ hasText: webhookToken.substring(0, 8) });
    await expect(webhookRow).toBeVisible();

    // Click "Test" within the specific row to trigger a test webhook delivery
    await webhookRow.getByRole("button", { name: "Test" }).click();

    // Assert the test webhook was received (event type is "webhook.test")
    await expect(webhookUrl).toHaveReceivedWebhook({ content: "webhook.test" });

    // Fetch the received request to verify the HMAC-SHA256 signature
    const requests = await queryWebhookRequests(webhookUrl, "webhook.test");
    const request = requests[0];

    const signatureHeader = request.headers["x-webhook-signature"]?.[0] ?? "";
    expect(signatureHeader).toMatch(/^sha256=/);

    // Strip the whsec_ prefix, base64url-decode to get the raw key bytes, then verify
    const secretBase64 = webhookSecret!.replace("whsec_", "").trim();
    const secretBytes = Buffer.from(secretBase64, "base64url");
    const hexDigest = signatureHeader.replace("sha256=", "");
    const expectedHmac = createHmac("sha256", secretBytes)
      .update(request.content)
      .digest("hex");

    expect(hexDigest).toBe(expectedHmac);

    // Clean up only the webhook created by this test. Do not delete all webhooks:
    // the test-run event assertions below rely on a static webhook seed in prod/preview.
    await deleteWebhookByToken(page, webhookToken);
  });

  test("static webhook receives test run queued and started events", async ({
    page,
  }) => {
    // This webhook URL is static seed data in both production and preview. The
    // test intentionally does not create or delete it; it triggers a run and
    // scopes assertions to the newly-created test run id.
    await openNewTestRunDialog(page);

    await page.getByRole("combobox", { name: "Environment" }).click();
    await page.getByRole("option", { name: "production" }).click();

    const testRunId = await triggerTestRunAndNavigate(page);
    test.info().annotations.push({
      type: "Webhook URL",
      description: TEST_RUN_EVENTS_WEBHOOK_URL,
    });

    await expectTestRunWebhook(
      TEST_RUN_EVENTS_WEBHOOK_URL,
      "test_run.queued",
      testRunId,
    );
    await expectTestRunWebhook(
      TEST_RUN_EVENTS_WEBHOOK_URL,
      "test_run.started",
      testRunId,
    );
  });
});
