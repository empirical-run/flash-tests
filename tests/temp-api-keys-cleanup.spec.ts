import { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { getApiAuthHeaders } from "./pages/api-auth";
import { getApiBaseUrl } from "./pages/urls";

interface ApiKeyRecord {
  id: number;
  name: string;
  is_internal?: boolean;
}

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

function isCleanupCandidate(apiKey: ApiKeyRecord): boolean {
  return !apiKey.is_internal && cleanupNamePatterns.some(pattern => apiKey.name.startsWith(pattern));
}

async function listApiKeys(page: Page, headers: Record<string, string>): Promise<ApiKeyRecord[]> {
  const response = await page.request.get(`${getApiBaseUrl()}/api/api-keys`, { headers });
  await expect(response).toBeOK();

  const responseBody = await response.json();
  return responseBody.data.api_keys;
}

async function deleteApiKeysInBatches(
  page: Page,
  headers: Record<string, string>,
  apiKeys: ApiKeyRecord[]
): Promise<void> {
  const batchSize = 10;

  for (let start = 0; start < apiKeys.length; start += batchSize) {
    const batch = apiKeys.slice(start, start + batchSize);
    const deleteResponses = await Promise.all(
      batch.map(apiKey => page.request.delete(`${getApiBaseUrl()}/api/api-keys/${apiKey.id}`, { headers }))
    );

    for (const response of deleteResponses) {
      await expect(response).toBeOK();
    }
  }
}

test.describe("TEMP: API Keys Cleanup", () => {
  test("cleanup accumulated test API keys", async ({ page }) => {
    const headers = await getApiAuthHeaders(page);
    const apiKeys = await listApiKeys(page, headers);
    const apiKeysToDelete = apiKeys.filter(isCleanupCandidate);

    await deleteApiKeysInBatches(page, headers, apiKeysToDelete);

    const remainingApiKeys = await listApiKeys(page, headers);
    expect(remainingApiKeys.filter(isCleanupCandidate)).toEqual([]);
  });
});
