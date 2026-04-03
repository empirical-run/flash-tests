import { test, expect } from "./fixtures";
import { getWebhookUrl, queryWebhookRequests } from "@empiricalrun/playwright-utils";
import { createHmac } from "crypto";

test.describe("Webhooks", () => {
  let createdWebhookUrl: string | null = null;

  test.afterEach(async ({ page }) => {
    if (!createdWebhookUrl) return;
    await page.goto("/");
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Webhooks' }).click();
    // Find the row by the first 8 chars of the webhook token (visible in truncated URL)
    const webhookToken = createdWebhookUrl.split('/').pop()!;
    const row = page.getByRole('row').filter({ hasText: webhookToken.substring(0, 8) });
    // Only delete if it was actually created (test may have failed before creation)
    if (await row.isVisible()) {
      await row.getByRole('button').last().click();
      await page.getByRole('button', { name: 'Delete' }).click();
    }
    createdWebhookUrl = null;
  });

  test("Add new webhook, run test webhook, and assert it", async ({ page }) => {
    // Generate a unique inbox webhook URL for this test
    const webhookUrl = await getWebhookUrl({ provider: "inbox" });
    // Track for cleanup in afterEach
    createdWebhookUrl = webhookUrl;

    // Navigate to Settings > Webhooks
    await page.goto("/");
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Webhooks' }).click();

    // Add a new webhook
    await page.getByRole('button', { name: 'Add Webhook' }).click();
    await page.getByRole('textbox', { name: 'Payload URL' }).fill(webhookUrl);
    await page.getByRole('checkbox', { name: 'Select all events' }).click();
    await page.getByRole('button', { name: 'Create' }).click();

    // After creation, the app shows a "Save your webhook secret" modal
    // Capture the secret (format: whsec_<base64url>) for signature verification
    const webhookSecret = await page.getByText(/^whsec_/).textContent();
    expect(webhookSecret).toMatch(/^whsec_/);
    await page.getByRole('button', { name: 'Done' }).click();

    // Webhook row should be visible in the list
    const webhookToken = webhookUrl.split('/').pop()!;
    const webhookRow = page.getByRole('row').filter({ hasText: webhookToken.substring(0, 8) });
    await expect(webhookRow).toBeVisible();

    // Click "Test" within the specific row to trigger a test webhook delivery
    await webhookRow.getByRole('button', { name: 'Test' }).click();

    // Assert the test webhook was received (event type is "webhook.test")
    await expect(webhookUrl).toHaveReceivedWebhook({ content: "webhook.test" });

    // Fetch the received request to verify the HMAC-SHA256 signature
    const requests = await queryWebhookRequests(webhookUrl, "webhook.test");
    const request = requests[0];

    const signatureHeader = request.headers['x-webhook-signature']?.[0] ?? '';
    expect(signatureHeader).toMatch(/^sha256=/);

    // The app signs the raw body using the full webhook secret string as the HMAC-SHA256 key
    const hexDigest = signatureHeader.replace('sha256=', '');
    const expectedHmac = createHmac('sha256', webhookSecret!.trim())
      .update(request.content)
      .digest('hex');

    expect(hexDigest).toBe(expectedHmac);
  });
});
