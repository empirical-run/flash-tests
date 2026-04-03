import { test, expect } from "./fixtures";
import { getWebhookUrl, queryWebhookRequests } from "@empiricalrun/playwright-utils";
import { createHmac } from "crypto";

test.describe("Webhooks", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Webhooks' }).click();

    // Wait for the page to fully load
    await expect(page.getByRole('button', { name: 'Add Webhook' })).toBeVisible();

    // Delete all existing webhooks for a clean slate
    const testButtons = page.getByRole('button', { name: 'Test', exact: true });
    let count = await testButtons.count();
    while (count > 0) {
      // Always delete the first data row (row index 1, since 0 is the header)
      await page.getByRole('row').nth(1).getByRole('button').last().click();
      await page.getByRole('button', { name: 'Delete' }).click();
      count--;
      await expect(testButtons).toHaveCount(count);
    }
  });

  test("Add new webhook, run test webhook, and assert it", async ({ page }) => {
    // Generate a unique inbox webhook URL for this test
    const webhookUrl = await getWebhookUrl({ provider: "inbox" });

    // Page is already on Settings > Webhooks from beforeEach
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

    // Strip the whsec_ prefix, base64url-decode to get the raw key bytes, then verify
    const secretBase64 = webhookSecret!.replace('whsec_', '').trim();
    const secretBytes = Buffer.from(secretBase64, 'base64url');
    const hexDigest = signatureHeader.replace('sha256=', '');
    const expectedHmac = createHmac('sha256', secretBytes)
      .update(request.content)
      .digest('hex');

    expect(hexDigest).toBe(expectedHmac);
  });
});
