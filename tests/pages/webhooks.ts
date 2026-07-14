import { expect, Locator, Page } from "@playwright/test";
import { queryWebhookRequests } from "@empiricalrun/playwright-utils";
import { getApiAuthHeaders } from "./api-auth";
import { navigateToSettings } from "./settings";
import { getApiBaseUrl, isPreviewEnvironment } from "./urls";

export function getTestRunEventsWebhookUrl(): string {
  if (process.env.TEST_RUN_EVENTS_WEBHOOK_URL) {
    return process.env.TEST_RUN_EVENTS_WEBHOOK_URL;
  }

  if (isPreviewEnvironment()) {
    return "https://inbox.empirical.run/hooks/flash-tests-test-run-events-preview";
  }

  return "https://inbox.empirical.run/hooks/flash-tests-test-run-events-production";
}

interface WebhookRecord {
  id: number;
  url: string;
  events: string[];
  is_active: boolean;
}

const TEST_RUN_WEBHOOK_EVENTS = ["test_run.queued", "test_run.started"];

async function listWebhooks(
  page: Page,
  headers: Record<string, string>,
): Promise<WebhookRecord[]> {
  const response = await page.request.get(`${getApiBaseUrl()}/api/webhooks`, {
    headers,
  });
  await expect(response).toBeOK();

  const responseBody = await response.json();
  return responseBody.data.webhooks;
}

async function createTestRunWebhook(
  page: Page,
  headers: Record<string, string>,
  webhookUrl: string,
): Promise<void> {
  const response = await page.request.post(`${getApiBaseUrl()}/api/webhooks`, {
    headers,
    data: {
      url: webhookUrl,
      events: TEST_RUN_WEBHOOK_EVENTS,
    },
  });
  await expect(response).toBeOK();
}

async function deleteWebhooksById(
  page: Page,
  headers: Record<string, string>,
  webhookIds: number[],
): Promise<void> {
  for (const webhookId of webhookIds) {
    const response = await page.request.delete(
      `${getApiBaseUrl()}/api/webhooks/${webhookId}`,
      { headers },
    );

    // Deleting too many rows concurrently can make the API return transient 500s.
    // Keep cleanup sequential, retry a single transient failure, and tolerate 404s
    // so parallel runs do not fail when another worker already removed the row.
    if (response.status() === 500) {
      const retryResponse = await page.request.delete(
        `${getApiBaseUrl()}/api/webhooks/${webhookId}`,
        { headers },
      );
      expect([200, 404]).toContain(retryResponse.status());
    } else {
      expect([200, 404]).toContain(response.status());
    }
  }
}

function isUuidInboxTestRunWebhook(webhook: WebhookRecord): boolean {
  const hasUuidInboxUrl =
    /https:\/\/inbox\.empirical\.run\/hooks\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      webhook.url,
    );
  const hasTestRunEvents = TEST_RUN_WEBHOOK_EVENTS.every((event) =>
    webhook.events.includes(event),
  );

  return hasUuidInboxUrl && hasTestRunEvents;
}

async function deleteWebhookRow(
  page: Page,
  webhookRow: Locator,
): Promise<void> {
  await webhookRow.getByRole("button").last().click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(webhookRow).not.toBeVisible();
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

  const headers = await getApiAuthHeaders(page);
  const webhooks = await listWebhooks(page, headers);
  const staleUuidWebhookIds = webhooks
    .filter(isUuidInboxTestRunWebhook)
    .map((webhook) => webhook.id);

  await deleteWebhooksById(page, headers, staleUuidWebhookIds);

  const remainingWebhooks = webhooks.filter(
    (webhook) => !staleUuidWebhookIds.includes(webhook.id),
  );
  const staticWebhook = remainingWebhooks.find(
    (webhook) => webhook.url === webhookUrl,
  );

  // Ensure/upsert semantics: fresh preview environments may not have the
  // static test-run webhook seeded yet, so create it before this test triggers
  // a run and waits for queued/started deliveries.
  if (!staticWebhook) {
    await createTestRunWebhook(page, headers, webhookUrl);
  }

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

export const expectStaticTestRunWebhookConfigured =
  ensureStaticTestRunWebhookConfigured;

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
