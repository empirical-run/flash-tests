import { test, expect } from "./fixtures";
import { getWebhookUrl } from "@empiricalrun/playwright-utils";

test.describe("Webhooks", () => {
  test("Add new webhook, run test webhook, and assert it", async ({ page }) => {
    // Generate a unique webhook URL for this test
    const webhookUrl = await getWebhookUrl({ provider: "inbox" });

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

    // TODO(agent on page): After creating the webhook, the modal should close. Now I need to find the newly created webhook in the list and click the "Test Webhook" (or similar) button to run a test. Show me what the webhook list looks like and what buttons/actions are available to trigger a test webhook. Also look for any success confirmation after clicking test.
  });
});
