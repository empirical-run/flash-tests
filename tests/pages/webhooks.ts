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

async function deleteWebhookRow(page: Page, webhookRow: ReturnType<Page["getByRole"]>): Promise<void> {
  await webhookRow.getByRole("button").last().click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(webhookRow).not.toBeVisible();
}

async function createWebhook(page: Page, webhookUrl: string): Promise<void> {
  await page.getByRole("button", { name: "Add Webhook" }).click();
  await page.getByRole("textbox", { name: "Payload URL" }).fill(webhookUrl);
  await page.getByRole("checkbox", { name: "Select all events" }).click();
  await page.getByRole("button", { name: "Create" }).click();

  // The secret is shown only once after webhook creation. Dismiss it so the new
  // row is visible before the caller continues.
  await expect(page.locator("code").filter({ hasText: /^whsec_.{10,}/ })).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
}

async function deleteStaleUuidTestRunWebhooks(page: Page): Promise<void> {
  const uuidTokenPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
  const staleWebhookRows = page
    .getByRole("row")
    .filter({ hasText: uuidTokenPattern })
    .filter({ hasText: /test_run\.queued/ })
    .filter({ hasText: /test_run\.started/ });

  while (await staleWebhookRows.count()) {
    await deleteWebhookRow(page, staleWebhookRows.first());
  }
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
  await deleteWebhookRow(page, webhookRow);
}

export async function ensureStaticTestRunWebhookConfigured(
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

  await deleteStaleUuidTestRunWebhooks(page);

  const webhookRow = page
    .getByRole("row")
    .filter({ hasText: webhookToken!.substring(0, 8) });

  if ((await webhookRow.count()) === 0) {
    await createWebhook(page, webhookUrl);
  }

  await expect(
    webhookRow,
    `Static test-run webhook ${webhookUrl} must be configured in Settings > Webhooks`,
  ).toBeVisible();
}

export const expectStaticTestRunWebhookConfigured = ensureStaticTestRunWebhookConfigured;

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
