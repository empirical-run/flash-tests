import { Page, expect } from "@playwright/test";
import { getApiWorkerAuthHeaders } from "./api-auth";
import { getApiBaseUrl } from "./urls";

/** Expire only the snooze owned by this test, and verify persisted expiration. */
export async function expireSnoozeAndVerify(
  page: Page,
  snoozeId: number,
): Promise<void> {
  const headers = await getApiWorkerAuthHeaders(page);
  const url = `${getApiBaseUrl()}/api/snoozes/${snoozeId}`;
  const response = await page.request.patch(url, {
    headers,
    data: { expire_now: true },
    timeout: 60000,
  });
  await expect(response).toBeOK();
  const body = await response.json();
  expect(body.data.snooze.id).toBe(snoozeId);

  await expect
    .poll(
      async () => {
        const persistedResponse = await page.request.get(url, {
          headers,
          timeout: 10000,
        });
        await expect(persistedResponse).toBeOK();
        const persistedBody = await persistedResponse.json();
        expect(persistedBody.data.snooze.id).toBe(snoozeId);
        return Date.parse(persistedBody.data.snooze.snooze_until) <= Date.now();
      },
      {
        message: `Test-created snooze #${snoozeId} must no longer be active before teardown ends`,
        timeout: 30000,
      },
    )
    .toBe(true);
}
