import { test, expect } from "./fixtures";
import { getWebhookUrl, queryWebhookRequests } from "@empiricalrun/playwright-utils";
import { createHmac } from "crypto";

test.describe("Webhooks", () => {
  let createdWebhookUrl: string | null = null;

  test.afterEach(async ({ page }) => {
    if (!createdWebhookUrl) return;
    // Navigate to webhooks settings and delete the webhook we created
    await page.goto("/");
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Webhooks' }).click();
    // Find the row with our webhook and click the delete button
    const webhookToken = createdWebhookUrl.split('/').pop()!;
    const row = page.getByRole('row').filter({ hasText: webhookToken.substring(0, 8) });
    // TODO(agent on page): Find the delete button in the webhook row and click it. If a confirmation dialog appears, confirm the deletion.
    createdWebhookUrl = null;
  });

  test("Add new webhook, run test webhook, and assert it", async ({ page }) => {
    // Generate a unique webhook URL for this test
    const webhookUrl = await getWebhookUrl({ provider: "inbox" });
    createdWebhookUrl = webhookUrl;

    // Navigate to the app
    await page.goto("/");

    // Navigate to Settings > Webhooks
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Webhooks' }).click();

    // Click "Add Webhook"
    await page.getByRole('button', { name: 'Add Webhook' }).click();

    // Fill in the webhook URL
    await page.getByRole('textbox', { name: 'Payload URL' }).fill(webhookUrl);

    // Select all events
    await page.getByRole('checkbox', { name: 'Select all events' }).click();

    // Create the webhook
    await page.getByRole('button', { name: 'Create' }).click();

    // After creation, a "Save your webhook secret" modal appears — read the secret
    const webhookSecret = await page.getByText(/^whsec_/).textContent();

    // Close the modal
    await page.getByRole('button', { name: 'Done' }).click();

    // Click the Test button to send a test webhook
    await page.getByRole('button', { name: 'Test', exact: true }).click();

    // Assert the webhook was received
    await expect(webhookUrl).toHaveReceivedWebhook({ content: "ping" });

    // Query the request to verify the HMAC-SHA256 signature
    const requests = await queryWebhookRequests(webhookUrl, "ping");
    const request = requests[0];

    const signatureHeader = request.headers['x-webhook-signature']?.[0] ?? '';
    expect(signatureHeader).toMatch(/^sha256=/);

    const secretBase64 = webhookSecret!.replace('whsec_', '').trim();
    const secretBytes = Buffer.from(secretBase64, 'base64url');
    const hexDigest = signatureHeader.replace('sha256=', '');
    const expectedHmac = createHmac('sha256', secretBytes)
      .update(request.content)
      .digest('hex');

    expect(hexDigest).toBe(expectedHmac);
  });
});
