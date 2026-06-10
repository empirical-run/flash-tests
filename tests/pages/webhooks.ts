import { expect, Page } from "@playwright/test";
import { queryWebhookRequests } from "@empiricalrun/playwright-utils";
import { navigateToSettings } from "./settings";

export function getTestRunEventsWebhookUrl(): string {
  if (process.env.TEST_RUN_EVENTS_WEBHOOK_URL) {
    return process.env.TEST_RUN_EVENTS_WEBHOOK_URL;
  }

  if (process.env.TEST_RUN_ENVIRONMENT === "preview") {
    return "https://inbox.empirical.run/hooks/flash-tests-test-run-events-preview";
  }

  return "https://inbox.empirical.run/hooks/flash-tests-test-run-events-production";
}

export async function deleteWebhookByToken(
  page: Page,
  webhookToken: string,
): Promise<void> {
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

export async function expectStaticTestRunWebhookConfigured(
  page: Page,
): Promise<void> {
  const webhookUrl = getTestRunEventsWebhookUrl();
  const webhookToken = webhookUrl.split("/").pop();
  expect(
    webhookToken,
    `Expected token in webhook URL: ${webhookUrl}`,
  ).toBeTruthy();

  await navigateToSettings(page, "Webhooks");
  await expect(page.getByRole("button", { name: "Add Webhook" })).toBeVisible();

  const webhookRow = page
    .getByRole("row")
    .filter({ hasText: webhookToken!.substring(0, 8) });
  await expect(
    webhookRow,
    `Static test-run webhook ${webhookUrl} must be configured in Settings > Webhooks`,
  ).toBeVisible();
}

export async function expectTestRunWebhook(
  eventType: "test_run.queued" | "test_run.started",
  testRunId: number,
): Promise<void> {
  const webhookUrl = getTestRunEventsWebhookUrl();
  const content = [eventType, String(testRunId)];

  await expect
    .poll(
      async () => {
        const requests = await queryWebhookRequests(webhookUrl, content);
        return requests.length;
      },
      {
        message: `waiting for ${eventType} webhook for test run ${testRunId}`,
        timeout: 120000,
      },
    )
    .toBeGreaterThan(0);
}
