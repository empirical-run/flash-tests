import { test, expect } from "./fixtures";
import { getWebhookUrl } from "@empiricalrun/playwright-utils";

test.describe("Webhooks", () => {
  test("Add new webhook, run test webhook, and assert it", async ({ page }) => {
    // Generate a unique webhook URL for this test
    const webhookUrl = await getWebhookUrl({ provider: "inbox" });

    // Navigate to the app
    await page.goto("/");

    // Navigate to Settings > Webhooks
    // TODO(agent on page): Navigate to settings, then find and click the Webhooks section in the settings sidebar. Then add a new webhook using the webhook URL stored in `webhookUrl` variable. After adding, run the test webhook on it, and assert that the webhook was triggered successfully.
  });
});
