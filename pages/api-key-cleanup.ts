import { expect, Page } from "@playwright/test";
import { getApiBaseUrl } from "./urls";

export interface ApiKeyRecord {
  id: number;
  name: string;
  created_at: string;
  is_internal?: boolean;
}

// A conservative fence: normal scenarios complete well within a day. Invalid
// or missing server timestamps never authorize shared maintenance deletion.
export const API_KEY_MAINTENANCE_MIN_AGE_MS = 24 * 60 * 60 * 1000;

const cleanupNamePatterns = [
  "Production-API-Key-",
  "development_api_key-",
  "API Key with Spaces-",
  "TestKey123-",
  "A-",
  "AB-",
  "API-Key_2024-",
  "My API Key (Dev)-",
  "API.Key.v1-",
  "12345-",
  "@APIKey-",
  "API-Key!-",
  "Very-Long-API-Key-Name-For-Testing-Maximum-Length-Limits-And-UI-Behavior-",
  " Leading Space-",
  "Trailing Space -",
  " Both Spaces -",
  "API-Key-🔑-",
  "Clé-API-française-",
  "Test-API-Key-",
  "Test-Status-Key-",
  "Delete-Confirmation-Test-",
  "Disabled-Test-Key-",
  "Cancel-Disable-Test-Key-",
  "Button-Text-Test-Key-",
  "Modal-Close-Test-Key-",
  "Cancel-Enable-Test-Key-",
  "Button-Text-Enable-Test-Key-",
  "E2E-Test-Key-",
  "Delete-Button-Disabled-Test-",
  "Delete-Button-Enabled-Test-",
];

/** Default-deny selection. Owned IDs must come from this test's create response. */
export function selectApiKeysForCleanup(
  apiKeys: ApiKeyRecord[],
  options: { ownedIds?: readonly number[]; staleBefore?: number },
): ApiKeyRecord[] {
  const ownedIds = options.ownedIds ?? [];
  return apiKeys.filter((apiKey) => {
    if (apiKey.is_internal) return false;
    if (ownedIds.includes(apiKey.id)) return true;
    const createdAt = Date.parse(apiKey.created_at);
    return (
      options.staleBefore !== undefined &&
      Number.isFinite(createdAt) &&
      createdAt <= options.staleBefore &&
      cleanupNamePatterns.some((pattern) => apiKey.name.startsWith(pattern))
    );
  });
}

export async function listApiKeysForCleanup(
  page: Page,
  headers: Record<string, string>,
): Promise<ApiKeyRecord[]> {
  const response = await page.request.get(`${getApiBaseUrl()}/api/api-keys`, {
    headers,
  });
  await expect(response).toBeOK();
  const { data } = await response.json();
  return data.api_keys;
}

export async function createOwnedCleanupKey(
  page: Page,
  headers: Record<string, string>,
  name: string,
): Promise<ApiKeyRecord> {
  const response = await page.request.put(`${getApiBaseUrl()}/api/api-keys`, {
    headers,
    data: { name },
  });
  await expect(response).toBeOK();
  const { data } = await response.json();
  const key = data.api_keys.find((key: ApiKeyRecord) => key.name === name);
  expect(key).toBeDefined();
  return key;
}

/** Only deletes the supplied snapshot; concurrent stale maintenance may win first. */
export async function deleteApiKeysInBatches(
  page: Page,
  headers: Record<string, string>,
  apiKeys: ApiKeyRecord[],
): Promise<void> {
  const batchSize = 10;
  for (let start = 0; start < apiKeys.length; start += batchSize) {
    const batch = apiKeys.slice(start, start + batchSize);
    const responses = await Promise.all(
      batch.map((apiKey) =>
        page.request.delete(`${getApiBaseUrl()}/api/api-keys/${apiKey.id}`, {
          headers,
        }),
      ),
    );
    for (const response of responses) {
      // This helper is idempotent for competing maintenance/owned teardown,
      // not a generic suppression of failed deletion responses.
      if (response.status() === 404) {
        expect(await response.json()).toMatchObject({
          data: null,
          error: { message: "API key not found" },
        });
      } else {
        await expect(response).toBeOK();
      }
    }
  }
}
